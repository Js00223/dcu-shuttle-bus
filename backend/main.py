import random
import datetime
import logging
import smtplib
from typing import List, Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import FastAPI, Depends, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

# 내가 만든 파일들 임포트
import models
from database import engine, get_db

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# --- [설정: 실제 메일을 보내기 위한 정보] ---
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 465
SMTP_USER = "j020218hh@gmail.com"
SMTP_PASSWORD = "heyxdsgbbzjtmngc" 

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

# --- [실시간 데이터 관리] ---
bus_realtime_locations = {
    1: {"lat": 35.9130, "lng": 128.8030, "status": "running", "bus_name": "하양역 방면"},
    2: {"lat": 35.8530, "lng": 128.7330, "status": "running", "bus_name": "반월당 방면"}
}

# --- [메일 발송 함수] ---
def send_real_email(receiver_email: str, code: str):
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER
        msg['To'] = receiver_email
        msg['Subject'] = "[대구가톨릭대 셔틀] 본인확인 인증번호입니다."
        content = f"안녕하세요. 비밀번호 재설정을 위한 인증번호는 [{code}] 입니다."
        msg.attach(MIMEText(content, 'plain'))
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, receiver_email, msg.as_string())
        return True
    except Exception as e:
        logger.error(f"❌ 메일 발송 에러: {e}")
        return False

# --- [1. 서버 시작 시 실행 로직] ---
@app.on_event("startup")
def startup_event():
    logger.info("🚀 서버 기동 중...")
    try:
        # models.py의 설정을 바탕으로 DB 테이블을 생성하거나 업데이트합니다.
        models.Base.metadata.create_all(bind=engine)
        logger.info("✅ 데이터베이스 및 모델 생성 완료")
    except Exception as e:
        logger.error(f"❌ DB 초기화 실패: {e}")

# --- [2. CORS 설정 수정] ---
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

# (1) 인증번호 발송
@app.post("/api/auth/send-code")
def send_verification_code(email: str):
    if not email.endswith("@cu.ac.kr"):
        raise HTTPException(status_code=400, detail="대구가톨릭대 메일만 가능합니다.")
    code = str(random.randint(100000, 999999))
    verification_codes[email] = code
    if send_real_email(email, code):
        return {"message": "인증번호가 발송되었습니다.", "status": "success"}
    else:
        raise HTTPException(status_code=500, detail="메일 서버 연결 실패")

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
def signup(email: str, password: str, name: str, code: str, db: Session = Depends(get_db)):
    if verification_codes.get(email) != code:
        raise HTTPException(status_code=400, detail="인증번호가 일치하지 않습니다.")
    existing_user = db.query(models.User).filter(models.User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 존재하는 계정입니다.")
    new_user = models.User(email=email, hashed_password=password, name=name, points=0)
    db.add(new_user)
    db.commit()
    return {"message": "회원가입 완료"}

# (4) 로그인
@app.post("/api/auth/login")
def login(email: str, password: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or user.hashed_password != password:
        raise HTTPException(status_code=401, detail="정보가 불일치합니다.")
    return {"user_id": user.id, "name": user.name, "points": user.points, "status": "success"}

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
    return {"user_id": user.id, "name": user.name, "points": user.points}

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

# --- [신규 기능: 쪽지 시스템] ---

# (9) 쪽지 목록 조회 (로그 에러 해결: receiver_id 참조 보장)
@app.get("/api/messages")
def get_messages(user_id: int, db: Session = Depends(get_db)):
    try:
        # models.py에 receiver_id가 정의되어 있어야 에러가 나지 않습니다.
        messages = db.query(models.Message).filter(
            models.Message.receiver_id == user_id
        ).order_by(models.Message.created_at.desc()).all()
        return messages
    except Exception as e:
        logger.error(f"쪽지 목록 조회 에러: {e}")
        # 이 에러가 계속된다면 models.py 파일에 Message 클래스 내 receiver_id가 정의되었는지 꼭 확인하세요.
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
