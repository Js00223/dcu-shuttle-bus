import os
import random
import datetime
import logging
import base64
from typing import List, Optional
from email.mime.text import MIMEText

from fastapi import FastAPI, Depends, HTTPException, status, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

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

# --- [설정: Gmail API 설정] ---
GMAIL_CLIENT_ID = os.getenv("GMAIL_CLIENT_ID")
GMAIL_CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET")
GMAIL_REFRESH_TOKEN = os.getenv("GMAIL_REFRESH_TOKEN")

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

# --- [1. 서버 시작 시 실행 로직] ---
@app.on_event("startup")
def startup_event():
    logger.info("🚀 서버 기동 및 DB 데이터 확인 중...")
    try:
        models.Base.metadata.create_all(bind=engine)
        
        db = next(get_db())
        if db.query(models.BusRoute).count() == 0:
            logger.info("🚚 노선 데이터가 없어 기본 데이터를 생성합니다.")
            sample_routes = [
                models.BusRoute(id=1, route_name="하양역 방면", location="정문 승강장", time="08:30", total_seats=45),
                models.BusRoute(id=2, route_name="대구 반월당 방면", location="공대 앞", time="09:00", total_seats=45),
                models.BusRoute(id=3, route_name="구미역 직행", location="본관 앞", time="08:45", total_seats=45)
            ]
            db.add_all(sample_routes)
            db.commit()
            logger.info("✅ 노선 데이터 복구 완료")
        db.close()
    except Exception as e:
        logger.error(f"❌ 초기화 에러: {e}")

# --- [2. CORS 설정] ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

verification_codes = {}

bus_realtime_locations = {
    1: {"lat": 35.9130, "lng": 128.8030, "status": "running", "bus_name": "하양역 방면"},
    2: {"lat": 35.8530, "lng": 128.7330, "status": "running", "bus_name": "반월당 방면"}
}

# --- [4. API 엔드포인트] ---

@app.get("/")
def read_root():
    return {"status": "running", "message": "DCU Shuttle API Server"}

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
@app.post("/api/api/auth/reset-password")
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
@app.post("/api/api/auth/signup")
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
@app.post("/api/api/auth/login")
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
@app.post("/api/api/auth/delete-account")
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

@app.get("/api/bus/track/{bus_id}")
def get_bus_location(bus_id: int, user_lat: float, user_lng: float):
    bus_info = bus_realtime_locations.get(bus_id)
    if not bus_info:
        raise HTTPException(status_code=404, detail="Bus not found")
    return {**bus_info, "bus_id": bus_id, "last_update": datetime.datetime.now().isoformat()}

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

@app.post("/api/user/update-phone")
def update_user_phone(request: PhoneUpdateRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저 없음")
    user.phone = request.phone
    db.commit()
    return {"message": "연락처 저장됨", "status": "success", "current_phone": user.phone}

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

# --- [🌟 수정: 예약 API (차등 요금 적용)] ---
@app.post("/api/bookings/reserve")
def reserve_bus(
    user_id: Optional[int] = Query(None),
    route_id: Optional[int] = Query(None),
    request: ReserveRequest = Body(None),
    db: Session = Depends(get_db)
):
    # 1. 파라미터 추출
    final_user_id = request.user_id if request and request.user_id else user_id
    final_route_id = request.route_id if request and request.route_id else route_id

    if not final_user_id or not final_route_id:
        raise HTTPException(status_code=422, detail="user_id와 route_id가 누락되었습니다.")

    # 2. 유저 및 노선 정보 가져오기
    user = db.query(models.User).filter(models.User.id == final_user_id).first()
    route = db.query(models.BusRoute).filter(models.BusRoute.id == final_route_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    if not route:
        raise HTTPException(status_code=404, detail="노선 정보를 찾을 수 없습니다.")

    # 3. 🌟 무료/유료 판별 로직
    # 무료 키워드 리스트
    free_keywords = ["대구", "하양", "교내", "셔틀", "순환", "등교", "하교"]
    
    # 노선 이름에 위 키워드 중 하나라도 포함되어 있으면 무료(0원), 아니면 유료(3000원)
    is_free = any(keyword in route.route_name for keyword in free_keywords)
    cost = 0 if is_free else 3000

    # 4. 포인트 확인 및 차감
    if cost > 0:
        if user.points < cost:
            raise HTTPException(status_code=400, detail=f"포인트가 부족합니다. (필요: {cost}P)")
        user.points -= cost

    # 5. 예약 생성 및 저장
    new_booking = models.Booking(user_id=final_user_id, route_id=final_route_id, status="reserved")
    db.add(new_booking)
    db.commit()
    db.refresh(user)

    return {
        "status": "success", 
        "message": "예약 완료", 
        "is_free": is_free, 
        "deducted_points": cost,
        "remaining_points": user.points
    }

@app.get("/api/messages")
def get_messages(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Message).filter(models.Message.receiver_id == user_id).order_by(models.Message.created_at.desc()).all()

@app.get("/api/messages/{message_id}")
def get_message_detail(message_id: int, db: Session = Depends(get_db)):
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if msg:
        msg.is_read = 1
        db.commit()
    return msg

@app.post("/api/messages/send")
def send_message(request: MessageCreate, db: Session = Depends(get_db)):
    new_msg = models.Message(
        sender_id=request.sender_id, receiver_id=request.receiver_id,
        title=request.title, content=request.content
    )
    db.add(new_msg)
    db.commit()
    return {"message": "쪽지 발송 완료", "status": "success"}
