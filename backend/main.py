import os
import random
import datetime
import logging
import base64
import re
import math
import requests  # 카카오 API 호출용
from typing import List, Optional, Dict
from email.mime.text import MIMEText

from fastapi import FastAPI, Depends, HTTPException, status, Body, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import uvicorn

# Google API 라이브러리
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

# 프로젝트 내부 모듈
import models
from database import engine, get_db

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# --- [설정: 환경 변수 및 API 키] ---
GMAIL_CLIENT_ID = os.getenv("GMAIL_CLIENT_ID")
GMAIL_CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET")
GMAIL_REFRESH_TOKEN = os.getenv("GMAIL_REFRESH_TOKEN")
# 카카오 개발자 콘솔에서 발급받은 REST API 키를 여기에 입력하세요.
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY", "YOUR_KAKAO_REST_API_KEY")

# --- [Pydantic 데이터 모델 정의] ---
class ChargeRequest(BaseModel):
    user_id: int
    amount: int

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str

class PhoneUpdateRequest(BaseModel):
    user_id: int
    phone: str
    code: str

class MessageCreate(BaseModel):
    sender_id: int
    receiver_id: int
    title: str
    content: str

class DeleteAccountRequest(BaseModel):
    user_id: int
    password: str

class FavoriteToggleRequest(BaseModel):
    user_id: int
    route_id: int

class ReserveRequest(BaseModel):
    user_id: Optional[int] = None
    route_id: Optional[int] = None

# [신규 추가] 취소 알림 및 ETA 관련 모델
class WaitingRequest(BaseModel):
    user_id: int
    route_id: int

class CancelReservationRequest(BaseModel):
    user_id: int
    booking_id: int
    route_id: int

# --- [실시간 알림 데이터 저장소] ---
waiting_list: Dict[int, List[int]] = {} # {route_id: [user_id, ...]}

# --- [메일 발송 함수] ---
def send_real_email(receiver_email: str, code: str):
    try:
        if not all([GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN]):
            logger.error("❌ Gmail API 환경 변수 설정 누락")
            return False

        creds = Credentials(
            None,
            refresh_token=GMAIL_REFRESH_TOKEN,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GMAIL_CLIENT_ID,
            client_secret=GMAIL_CLIENT_SECRET,
        )

        if not creds.valid:
            creds.refresh(Request())

        service = build('gmail', 'v1', credentials=creds)

        message = MIMEText(f"안녕하세요. 대구가톨릭대 셔틀 서비스 본인확인 인증번호는 [{code}] 입니다.")
        message['to'] = receiver_email
        message['from'] = "me"
        message['subject'] = "[대구가톨릭대 셔틀] 인증번호 안내"

        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        service.users().messages().send(userId="me", body={'raw': raw_message}).execute()
        
        logger.info(f"✅ Gmail API 발송 성공: {receiver_email}")
        return True

    except Exception as e:
        logger.error(f"❌ Gmail API 발송 에러: {e}")
        return False

# --- [서버 시작 시 실행 로직] ---
@app.on_event("startup")
def startup_event():
    logger.info("🚀 서버 기동 및 DB 데이터 확인 중...")
    try:
        models.Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.error(f"❌ 초기화 에러: {e}")

# --- [CORS 설정] ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

verification_codes = {}

# --- [백그라운드 함수: 취소 표 알림 발송] ---
def notify_waiters(route_id: int, db: Session):
    waiters = waiting_list.get(route_id, [])
    if not waiters:
        return

    route = db.query(models.BusRoute).filter(models.BusRoute.id == route_id).first()
    route_name = route.route_name if route else "알 수 없는 노선"

    for user_id in waiters:
        new_msg = models.Message(
            sender_id=0, # 시스템 자동 발송 ID
            receiver_id=user_id,
            title="[대구가톨릭대] 빈자리 알림",
            content=f"신청하신 '{route_name}' 노선에 빈자리가 생겼습니다! 지금 앱에서 예약하세요."
        )
        db.add(new_msg)
    
    db.commit()
    waiting_list[route_id] = [] # 알림 발송 후 해당 노선 대기열 초기화

# --- [API 엔드포인트] ---

@app.get("/")
def read_root():
    return {"status": "running", "message": "DCU Shuttle API Server"}

# [신규 추가] 카카오 모빌리티 기반 정교한 ETA 계산
@app.get("/api/shuttle/precise-eta")
async def get_precise_eta(origin: str, destination: str):
    """
    origin: "경도,위도", destination: "경도,위도"
    """
    url = "https://apis-navi.kakaomobility.com/v1/directions"
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {
        "origin": origin,
        "destination": destination,
        "priority": "TIME"
    }
    
    try:
        response = requests.get(url, headers=headers, params=params)
        data = response.json()
        
        if "routes" not in data:
            raise HTTPException(status_code=400, detail="경로를 찾을 수 없습니다.")
            
        summary = data['routes'][0]['summary']
        duration_min = math.ceil(summary['duration'] / 60)
        distance_km = round(summary['distance'] / 1000, 1)
        
        return {
            "status": "success",
            "duration_min": duration_min,
            "distance_km": distance_km,
            "message": "곧 도착" if duration_min <= 1 else f"{duration_min}분 후 도착 예정"
        }
    except Exception as e:
        logger.error(f"Kakao API Error: {e}")
        raise HTTPException(status_code=500, detail="카카오 길찾기 API 연동 실패")

# [신규 추가] 취소 표 대기 등록 API
@app.post("/api/shuttle/wait-list")
def add_to_waiting_list(request: WaitingRequest):
    if request.route_id not in waiting_list:
        waiting_list[request.route_id] = []
    
    if request.user_id not in waiting_list[request.route_id]:
        waiting_list[request.route_id].append(request.user_id)
        
    return {"status": "success", "message": "빈자리 알림이 등록되었습니다."}

@app.post("/api/auth/send-code")
def send_verification_code(email: str):
    if not email.endswith("@cu.ac.kr"):
        raise HTTPException(status_code=400, detail="대구가톨릭대 메일만 가능합니다.")
    
    code = str(random.randint(100000, 999999))
    verification_codes[email] = code
    
    email_sent = send_real_email(email, code)
    if email_sent:
        return {"message": "인증번호가 발송되었습니다.", "status": "success"}
    else:
        return {"message": "인증번호 발송 실패(테스트 코드 반환)", "test_code": code, "status": "success"}

@app.post("/api/auth/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    if verification_codes.get(request.email) != request.code:
        raise HTTPException(status_code=400, detail="인증번호가 일치하지 않습니다.")
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    
    user.hashed_password = request.new_password
    db.commit()
    return {"message": "비밀번호가 변경되었습니다.", "status": "success"}

@app.post("/api/auth/signup")
def signup(email: str, password: str, name: str, code: str, db: Session = Depends(get_db)):
    if verification_codes.get(email) != code:
        raise HTTPException(status_code=400, detail="인증번호가 일치하지 않습니다.")
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="이미 존재하는 계정입니다.")
    
    new_user = models.User(email=email, hashed_password=password, name=name, points=0)
    db.add(new_user)
    db.commit()
    return {"message": "회원가입 완료", "status": "success"}

@app.post("/api/auth/login")
def login(email: str, password: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or user.hashed_password != password:
        raise HTTPException(status_code=401, detail="정보가 불일치합니다.")
    
    fav_ids = [f.route_id for f in db.query(models.Favorite).filter(models.Favorite.user_id == user.id).all()]
    return {
        "user_id": user.id, "name": user.name, "points": user.points, 
        "favorites": fav_ids, "status": "success"
    }

@app.post("/api/auth/delete-account")
def delete_account(request: DeleteAccountRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not user or user.hashed_password != request.password:
        raise HTTPException(status_code=401, detail="비밀번호가 틀렸습니다.")
    db.delete(user)
    db.commit()
    return {"message": "회원 탈퇴 완료", "status": "success"}

@app.get("/api/routes")
def get_all_routes(db: Session = Depends(get_db)):
    return db.query(models.BusRoute).all()

@app.get("/api/user/status")
def get_user_status(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저 정보 없음")
    fav_ids = [f.route_id for f in db.query(models.Favorite).filter(models.Favorite.user_id == user.id).all()]
    return {
        "user_id": user.id, "name": user.name, "points": user.points, 
        "email": user.email, "phone": getattr(user, "phone", "미등록"), 
        "favorites": fav_ids
    }

@app.post("/api/charge/request")
def charge_points(request: ChargeRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저 없음")
    user.points += request.amount
    db.commit()
    db.refresh(user)
    return {"points": user.points, "status": "success"}

# [수정] 예약 취소 및 알림 시스템 연동
@app.post("/api/bookings/cancel")
def cancel_reservation(request: CancelReservationRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(
        models.Booking.id == request.booking_id,
        models.Booking.user_id == request.user_id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="예약 내역을 찾을 수 없습니다.")
    
    # 예약 취소 로직
    db.delete(booking)
    db.commit()

    # 백그라운드에서 해당 노선 대기자들에게 알림 발송
    background_tasks.add_task(notify_waiters, request.route_id, db)

    return {"status": "success", "message": "취소 완료. 대기자에게 알림이 전송됩니다."}

@app.post("/api/user/update-phone")
def update_user_phone(request: PhoneUpdateRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저 정보를 찾을 수 없습니다.")

    stored_code = verification_codes.get(user.email)
    if not stored_code or stored_code != request.code:
        raise HTTPException(status_code=400, detail="인증번호가 유효하지 않거나 일치하지 않습니다.")

    phone_pattern = re.compile(r"^010-([2-9]\d{3})-(\d{4})$")
    if not phone_pattern.match(request.phone):
        raise HTTPException(status_code=400, detail="올바른 휴대전화 번호 형식이 아닙니다.")

    parts = request.phone.split("-")
    mid, last = parts[1], parts[2]

    if len(set(mid)) == 1 or len(set(last)) == 1:
        raise HTTPException(status_code=400, detail="동일 숫자가 반복되는 번호는 사용할 수 없습니다.")

    sequential_patterns = ["0123", "1234", "2345", "3456", "4567", "5678", "6789", 
                           "9876", "8765", "7654", "6543", "5432", "4321", "3210"]
    if mid in sequential_patterns or last in sequential_patterns:
        raise HTTPException(status_code=400, detail="연속된 숫자가 포함된 번호는 사용할 수 없습니다.")

    if mid == last:
        raise HTTPException(status_code=400, detail="중간 번호와 끝 번호가 동일할 수 없습니다.")

    user.phone = request.phone
    db.commit()
    if user.email in verification_codes:
        del verification_codes[user.email]
        
    return {"message": "연락처가 성공적으로 변경되었습니다.", "status": "success", "current_phone": user.phone}

@app.post("/api/user/toggle-favorite")
def toggle_favorite(request: FavoriteToggleRequest, db: Session = Depends(get_db)):
    fav = db.query(models.Favorite).filter(
        models.Favorite.user_id == request.user_id,
        models.Favorite.route_id == request.route_id
    ).first()
    if fav:
        db.delete(fav)
    else:
        db.add(models.Favorite(user_id=request.user_id, route_id=request.route_id))
    db.commit()
    fav_ids = [f.route_id for f in db.query(models.Favorite).filter(models.Favorite.user_id == request.user_id).all()]
    return {"status": "success", "favorites": fav_ids}

@app.post("/api/bookings/reserve")
def reserve_bus(
    user_id: Optional[int] = Query(None),
    route_id: Optional[int] = Query(None),
    request: ReserveRequest = Body(None),
    db: Session = Depends(get_db)
):
    final_user_id = request.user_id if request and request.user_id else user_id
    final_route_id = request.route_id if request and request.route_id else route_id

    if not final_user_id or not final_route_id:
        raise HTTPException(status_code=422, detail="필수 정보 누락")

    user = db.query(models.User).filter(models.User.id == final_user_id).first()
    route = db.query(models.BusRoute).filter(models.BusRoute.id == final_route_id).first()

    if not user or not route:
        raise HTTPException(status_code=404, detail="정보를 찾을 수 없습니다.")

    out_of_city_keywords = ["울산", "경주", "구미", "포항"]
    is_out_of_city = any(keyword in route.route_name for keyword in out_of_city_keywords)
    
    cost = 3000 if is_out_of_city else 0

    if cost > 0:
        if user.points < cost:
            raise HTTPException(status_code=400, detail=f"포인트 부족 (시외노선: {cost}P 필요)")
        user.points -= cost

    new_booking = models.Booking(user_id=final_user_id, route_id=final_route_id, status="reserved")
    db.add(new_booking)
    db.commit()

    return {"status": "success", "is_free": cost == 0, "deducted": cost, "remaining": user.points}

@app.get("/api/messages")
def get_messages(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Message).filter(models.Message.receiver_id == user_id).order_by(models.Message.created_at.desc()).all()

@app.post("/api/messages/send")
def send_message(request: MessageCreate, db: Session = Depends(get_db)):
    new_msg = models.Message(sender_id=request.sender_id, receiver_id=request.receiver_id, title=request.title, content=request.content)
    db.add(new_msg)
    db.commit()
    return {"status": "success"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
