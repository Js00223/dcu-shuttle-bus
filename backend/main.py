import os
import random
import datetime
import logging
import base64
from typing import List, Optional
from email.mime.text import MIMEText

from fastapi import FastAPI, Depends, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

# Google API 라이브러리
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

# 내가 만든 파일들 임포트
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
    user_id: int
    route_id: int

# --- [실시간 데이터 관리 (임시)] ---
bus_realtime_locations = {
    1: {"lat": 35.9130, "lng": 128.8030, "status": "running", "bus_name": "하양역 방면"},
    2: {"lat": 35.8530, "lng": 128.7330, "status": "running", "bus_name": "반월당 방면"}
}

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
        return True
    except Exception as e:
        logger.error(f"❌ Gmail API 발송 에러: {e}")
        return False

# --- [1. 서버 시작 시 실행 로직] ---
@app.on_event("startup")
def startup_event():
    logger.info("🚀 서버 기동 및 데이터 확인 중...")
    try:
        models.Base.metadata.create_all(bind=engine)
        db = next(get_db())
        if db.query(models.BusRoute).count() == 0:
            logger.info("🚚 노선 데이터 생성 중...")
            routes = [
                models.BusRoute(id=1, route_name="하양역 방면", location="정문 승강장", time="08:30", total_seats=45),
                models.BusRoute(id=2, route_name="반월당 방면", location="공대 앞", time="09:00", total_seats=45),
                models.BusRoute(id=3, route_name="안심역 방면", location="본관 앞", time="08:45", total_seats=45)
            ]
            db.add_all(routes)
            db.commit()
        db.close()
        logger.info("✅ 데이터베이스 준비 완료")
    except Exception as e:
        logger.error(f"❌ 초기화 실패: {e}")

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
    if send_real_email(email, code):
        return {"message": "인증번호 발송 완료", "status": "success"}
    return {"message": "테스트 모드", "test_code": code, "status": "success"}

@app.post("/api/auth/reset-password")
@app.post("/api/api/auth/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    if verification_codes.get(request.email) != request.code:
        raise HTTPException(status_code=400, detail="인증번호 불일치")
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user: raise HTTPException(status_code=404, detail="유저 없음")
    user.hashed_password = request.new_password
    db.commit()
    return {"message": "비밀번호 변경 완료", "status": "success"}

@app.post("/api/auth/signup")
@app.post("/api/api/auth/signup")
def signup(email: str, password: str, name: str, code: str, db: Session = Depends(get_db)):
    if verification_codes.get(email) != code:
        raise HTTPException(status_code=400, detail="인증번호 불일치")
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="이미 가입된 계정")
    new_user = models.User(email=email, hashed_password=password, name=name, points=0)
    db.add(new_user)
    db.commit()
    return {"message": "가입 완료", "status": "success"}

@app.post("/api/auth/login")
@app.post("/api/api/auth/login")
def login(email: str, password: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or user.hashed_password != password:
        raise HTTPException(status_code=401, detail="인증 실패")
    
    # 🌟 즐겨찾기 목록 동기화
    fav_ids = [f.route_id for f in db.query(models.Favorite).filter(models.Favorite.user_id == user.id).all()]
    
    return {
        "user_id": user.id, 
        "name": user.name, 
        "points": user.points, 
        "favorites": fav_ids, # 최신 즐겨찾기 반환
        "status": "success"
    }

@app.get("/api/routes")
def get_all_routes(db: Session = Depends(get_db)):
    return db.query(models.BusRoute).all()

@app.get("/api/user/status")
def get_user_status(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404)
    
    # 🌟 최신 즐겨찾기 목록 다시 가져오기
    fav_ids = [f.route_id for f in db.query(models.Favorite).filter(models.Favorite.user_id == user.id).all()]
    
    return {
        "user_id": user.id,
        "name": user.name,
        "points": user.points,
        "email": user.email,
        "phone": getattr(user, "phone", "미등록"),
        "favorites": fav_ids
    }

@app.post("/api/user/toggle-favorite")
def toggle_favorite(request: FavoriteToggleRequest, db: Session = Depends(get_db)):
    try:
        # 이미 즐겨찾기 되어있는지 확인
        fav = db.query(models.Favorite).filter(
            models.Favorite.user_id == request.user_id,
            models.Favorite.route_id == request.route_id
        ).first()

        if fav:
            db.delete(fav)
            logger.info(f"⭐ 즐겨찾기 해제: User {request.user_id}, Route {request.route_id}")
        else:
            new_fav = models.Favorite(user_id=request.user_id, route_id=request.route_id)
            db.add(new_fav)
            logger.info(f"⭐ 즐겨찾기 추가: User {request.user_id}, Route {request.route_id}")
        
        db.commit()
        
        # 🌟 변경 후의 전체 즐겨찾기 목록을 다시 조회해서 반환
        updated_favs = [f.route_id for f in db.query(models.Favorite).filter(models.Favorite.user_id == request.user_id).all()]
        return {"status": "success", "favorites": updated_favs}
    except Exception as e:
        db.rollback()
        logger.error(f"❌ 즐겨찾기 토글 실패: {e}")
        raise HTTPException(status_code=500, detail="즐겨찾기 처리 중 오류")

@app.post("/api/charge/request")
def charge_points(request: ChargeRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not user: raise HTTPException(status_code=404)
    user.points += request.amount
    db.commit()
    db.refresh(user)
    return {"points": user.points, "status": "success"}

@app.post("/api/user/update-phone")
def update_user_phone(request: PhoneUpdateRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not user: raise HTTPException(status_code=404)
    user.phone = request.phone
    db.commit()
    return {"status": "success", "current_phone": user.phone}

@app.post("/api/bookings/reserve")
def reserve_bus(request: ReserveRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not user or user.points < 500: raise HTTPException(status_code=400, detail="포인트 부족")
    user.points -= 500
    db.add(models.Booking(user_id=request.user_id, route_id=request.route_id, status="reserved"))
    db.commit()
    return {"status": "success", "remaining_points": user.points}

@app.get("/api/messages")
def get_messages(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Message).filter(models.Message.receiver_id == user_id).all()

@app.get("/api/messages/{message_id}")
def get_message_detail(message_id: int, db: Session = Depends(get_db)):
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if msg: 
        msg.is_read = 1
        db.commit()
    return msg

@app.post("/api/messages/send")
def send_message(request: MessageCreate, db: Session = Depends(get_db)):
    db.add(models.Message(sender_id=request.sender_id, receiver_id=request.receiver_id, title=request.title, content=request.content))
    db.commit()
    return {"status": "success"}

@app.post("/api/auth/delete-account")
@app.post("/api/api/auth/delete-account")
def delete_account(request: DeleteAccountRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not user or user.hashed_password != request.password:
        raise HTTPException(status_code=401, detail="인증 실패")
    db.delete(user)
    db.commit()
    return {"message": "탈퇴 완료", "status": "success"}

@app.get("/api/bus/track/{bus_id}")
def get_bus_location(bus_id: int, user_lat: float, user_lng: float):
    bus_info = bus_realtime_locations.get(bus_id)
    if not bus_info: raise HTTPException(status_code=404)
    return {**bus_info, "bus_id": bus_id, "last_update": datetime.datetime.now().isoformat()}
