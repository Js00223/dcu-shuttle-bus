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
# 보안을 위해 Render의 Environment Variables(환경 변수)에 등록하는 것을 권장합니다.
GMAIL_CLIENT_ID = os.getenv("GMAIL_CLIENT_ID")
GMAIL_CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET")
GMAIL_REFRESH_TOKEN = os.getenv("GMAIL_REFRESH_TOKEN")

# --- [데이터 모델 정의] ---
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

# --- [실시간 데이터 관리] ---
bus_realtime_locations = {
    1: {"lat": 35.9130, "lng": 128.8030, "status": "running", "bus_name": "하양역 방면"},
    2: {"lat": 35.8530, "lng": 128.7330, "status": "running", "bus_name": "반월당 방면"}
}

# --- [메일 발송 함수: Gmail API 적용] ---
def send_real_email(receiver_email: str, code: str):
    try:
        # OAuth2 자격 증명 생성
        creds = Credentials(
            None,
            refresh_token=GMAIL_REFRESH_TOKEN,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GMAIL_CLIENT_ID,
            client_secret=GMAIL_CLIENT_SECRET,
        )

        # 토큰 만료 시 갱신
        if not creds.valid:
            creds.refresh(Request())

        # Gmail 서비스 빌드
        service = build('gmail', 'v1', credentials=creds)

        # 메일 내용 구성
        message = MIMEText(f"안녕하세요. 대구가톨릭대 셔틀 서비스 본인확인 인증번호는 [{code}] 입니다.")
        message['to'] = receiver_email
        message['subject'] = "[대구가톨릭대 셔틀] 인증번호 안내"

        # Base64 인코딩
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        
        # 메일 발송 실행
        service.users().messages().send(userId="me", body={'raw': raw_message}).execute()
        
        logger.info(f"✅ Gmail API 발송 성공: {receiver_email}")
        return True

    except Exception as e:
        logger.error(f"❌ Gmail API 발송 에러: {e}")
        return False

# --- [1. 서버 시작 시 실행 로직] ---
@app.on_event("startup")
def startup_event():
    logger.info("🚀 서버 기동 및 DB 테이블 동기화 중...")
    try:
        models.Base.metadata.create_all(bind=engine)
        logger.info("✅ 데이터베이스 모델 동기화 완료")
    except Exception as e:
        logger.error(f"❌ DB 초기화 실패: {e}")

# --- [2. CORS 설정] ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://dcu-shuttle-bus.vercel.app",
        "https://dcu-shuttle-ipy5hmm9o-heos-projects-ecded165.vercel.app",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

verification_codes = {}

# --- [4. API 엔드포인트] ---

@app.get("/")
def read_root():
    return {"status": "running", "message": "DCU Shuttle API Server"}

# (1) 인증번호 발송
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
        logger.warning(f"⚠️ [비상모드] 메일 발송 실패. 대신 인증번호를 반환함: {code}")
        return {
            "message": "메일 서버 연결 불안정으로 인해 테스트 코드가 발송되었습니다.",
            "test_code": code,
            "status": "success"
        }

# (2) 비밀번호 재설정
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

# (3) 회원가입
@app.post("/api/auth/signup")
@app.post("/api/api/auth/signup")
def signup(email: str, password: str, name: str, code: str, db: Session = Depends(get_db)):
    if verification_codes.get(email) != code:
        raise HTTPException(status_code=400, detail="인증번호가 일치하지 않습니다.")
    existing_user = db.query(models.User).filter(models.User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 존재하는 계정입니다.")
    new_user = models.User(email=email, hashed_password=password, name=name, points=0)
    db.add(new_user)
    db.commit()
    return {"message": "회원가입 완료", "status": "success"}

# (4) 로그인
@app.post("/api/auth/login")
@app.post("/api/api/auth/login")
def login(email: str, password: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or user.hashed_password != password:
        raise HTTPException(status_code=401, detail="정보가 불일치합니다.")
    return {"user_id": user.id, "name": user.name, "points": user.points, "status": "success"}

# (12) 회원 탈퇴
@app.post("/api/auth/delete-account")
@app.post("/api/api/auth/delete-account")
@app.post("/auth/delete-account")
def delete_account(request: DeleteAccountRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    
    if user.hashed_password != request.password:
        raise HTTPException(status_code=401, detail="비밀번호가 틀렸습니다. 탈퇴할 수 없습니다.")
    
    try:
        db.delete(user)
        db.commit()
        logger.info(f"👤 유저 탈퇴 성공: ID {request.user_id}")
        return {"message": "회원 탈퇴가 완료되었습니다.", "status": "success"}
    except Exception as e:
        db.rollback()
        logger.error(f"❌ 탈퇴 처리 중 에러: {e}")
        raise HTTPException(status_code=500, detail="서버 내부 오류로 탈퇴에 실패했습니다.")

# 노선조회
@app.get("/api/routes")
def get_all_routes(db: Session = Depends(get_db)):
    return db.query(models.BusRoute).all()

# (5) 버스 위치 추적
@app.get("/api/bus/track/{bus_id}")
def get_bus_location(bus_id: int, user_lat: float, user_lng: float):
    bus_info = bus_realtime_locations.get(bus_id)
    if not bus_info:
        raise HTTPException(status_code=404, detail="Bus not found")
    return {
        "bus_id": bus_id,
        "lat": bus_info["lat"],
        "lng": bus_info["lng"],
        "status": bus_info["status"],
        "bus_name": bus_info["bus_name"],
        "last_update": datetime.datetime.now().isoformat()
    }

# (6) 내 정보 조회
@app.get("/api/user/status")
def get_user_status(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저 없음")
    return {"user_id": user.id, "name": user.name, "points": user.points, "email":user.email, "phone":user.phone}

# (7) 포인트 충전
@app.post("/api/charge/request")
def charge_points(request: ChargeRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저 없음")
    user.points += request.amount
    db.commit()
    return {"points": user.points, "status": "success"}

# (8) 마이페이지>전화번호 변경
@app.post("/api/user/update-phone")
def update_user_phone(request: PhoneUpdateRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    try:
        user.phone = request.phone
        db.commit()
        return {"message": "연락처가 성공적으로 수정되었습니다.", "status": "success"}
    except Exception as e:
        db.rollback()
        logger.error(f"연락처 수정 에러: {e}")
        raise HTTPException(status_code=500, detail="데이터베이스 업데이트 실패")

# (9) 쪽지 목록 조회
@app.get("/api/messages")
def get_messages(user_id: int, db: Session = Depends(get_db)):
    try:
        messages = db.query(models.Message).filter(
            models.Message.receiver_id == user_id
        ).order_by(models.Message.created_at.desc()).all()
        return messages
    except Exception as e:
        logger.error(f"쪽지 목록 조회 에러: {e}")
        raise HTTPException(status_code=500, detail=f"서버 내부 에러: {str(e)}")

# (10) 쪽지 상세 조회
@app.get("/api/messages/{message_id}")
def get_message_detail(message_id: int, db: Session = Depends(get_db)):
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="쪽지를 찾을 수 없습니다.")
    try:
        msg.is_read = 1
        db.commit()
    except Exception:
        db.rollback()
    return msg

# (11) 쪽지 보내기
@app.post("/api/messages/send")
def send_message(request: MessageCreate, db: Session = Depends(get_db)):
    try:
        new_msg = models.Message(
            sender_id=request.sender_id,
            receiver_id=request.receiver_id,
            title=request.title,
            content=request.content
        )
        db.add(new_msg)
        db.commit()
        return {"message": "쪽지가 성공적으로 발송되었습니다.", "status": "success"}
    except Exception as e:
        db.rollback()
        logger.error(f"쪽지 발송 에러: {e}")
        raise HTTPException(status_code=500, detail="쪽지 발송 실패")
