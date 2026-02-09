import os
import random
import datetime
import logging
import base64
import re  # 🌟 정규표현식 추가
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

# 🌟 수정: 전화번호 변경 시 인증번호(code)를 필수로 받음
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

# --- [🌟 수정: 전화번호 변경 API - 본인 인증 및 유효성 검사 강화] ---
@app.post("/api/user/update-phone")
def update_user_phone(request: PhoneUpdateRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저 정보를 찾을 수 없습니다.")

    # 1. 인증번호 검증 (verification_codes 전역 변수 활용)
    stored_code = verification_codes.get(user.email)
    if not stored_code or stored_code != request.code:
        raise HTTPException(status_code=400, detail="인증번호가 유효하지 않거나 일치하지 않습니다.")

    # 2. 전화번호 유효성 검사 (Regex)
    # 형식: 010-XXXX-XXXX (국번은 2-9로 시작하는 4자리, 끝은 4자리)
    phone_pattern = re.compile(r"^010-([2-9]\d{3})-(\d{4})$")
    if not phone_pattern.match(request.phone):
        raise HTTPException(status_code=400, detail="유효한 전화번호 형식이 아닙니다. (010-0000-0000)")

    # 3. 비정상 패턴 검사 (연속 숫자 또는 동일 숫자 반복)
    parts = request.phone.split("-")
    for p in parts[1:]:
        if p in ["1234", "2345", "3456", "4567", "5678", "6789", "0123"] or p in [str(i)*4 for i in range(10)]:
             raise HTTPException(status_code=400, detail="사용할 수 없는 번호 패턴입니다.")

    # 4. 저장 및 인증번호 초기화
    user.phone = request.phone
    db.commit()
    if user.email in verification_codes:
        del verification_codes[user.email] # 재사용 방지

    return {"message": "인증 완료 및 연락처 저장됨", "status": "success", "current_phone": user.phone}

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
