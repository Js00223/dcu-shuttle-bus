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
# 네이버 기준 예시입니다. 구글을 쓰시면 smtp.gmail.com / 587 포트를 사용하세요.
SMTP_SERVER = "smtp.naver.com"
SMTP_PORT = 465
SMTP_USER = "your_id@naver.com"  # 본인의 네이버 이메일
SMTP_PASSWORD = "your_app_password"  # 네이버에서 발급받은 '앱 비밀번호'

# --- [데이터 모델 정의] ---
class ChargeRequest(BaseModel):
    user_id: int
    amount: int

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str

# --- [메일 발송 함수] ---
def send_real_email(receiver_email: str, code: str):
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER
        msg['To'] = receiver_email
        msg['Subject'] = "[대구가톨릭대 셔틀] 본인확인 인증번호입니다."

        content = f"""
        안녕하세요, 대구가톨릭대 셔틀 서비스입니다.
        비밀번호 재설정을 위한 인증번호는 [{code}] 입니다.
        화면의 입력창에 해당 번호를 입력해주세요.
        """
        msg.attach(MIMEText(content, 'plain'))

        # SSL 방식을 사용하여 메일 발송
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
    logger.info("🚀 서버 기동 중: 데이터베이스 연결 확인...")
    try:
        models.Base.metadata.create_all(bind=engine)
        with engine.connect() as connection:
            result = connection.execute(text("SELECT NOW();")).fetchone()
            logger.info(f"✅ DB 연결 성공! 시간: {result[0]}")
    except Exception as e:
        logger.error(f"❌ DB 연결 실패: {e}")

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

# 임시 코드 저장소 (실제 서비스에서는 Redis 등을 권장)
verification_codes = {}

# --- [4. API 엔드포인트] ---

# (1) 인증번호 발송 (실제 메일 발송 추가)
@app.post("/api/auth/send-code")
def send_verification_code(email: str):
    if not email.endswith("@cu.ac.kr"):
        raise HTTPException(status_code=400, detail="대구가톨릭대 메일만 가능합니다.")
    
    code = str(random.randint(100000, 999999))
    verification_codes[email] = code
    
    # 실제 메일 전송 시도
    if send_real_email(email, code):
        logger.info(f"📧 [메일 발송 성공] To: {email}")
        return {"message": "인증번호가 발송되었습니다.", "status": "success"}
    else:
        # SMTP 설정이 잘못되었거나 연결 오류 시
        raise HTTPException(status_code=500, detail="메일 서버 오류가 발생했습니다.")

# (2) 비밀번호 재설정
@app.post("/api/auth/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    # 1. 인증번호 확인
    if verification_codes.get(request.email) != request.code:
        raise HTTPException(status_code=400, detail="인증번호가 일치하지 않거나 만료되었습니다.")
    
    # 2. 사용자 확인
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="해당 이메일로 가입된 유저가 없습니다.")
    
    # 3. 비밀번호 업데이트 (실제로는 해싱 필요)
    user.hashed_password = request.new_password
    db.commit()
    
    # 4. 사용한 인증번호 삭제
    del verification_codes[request.email]
    
    return {"message": "비밀번호가 성공적으로 변경되었습니다.", "status": "success"}

# (3) 회원가입
@app.post("/api/auth/signup")
def signup(email: str, password: str, name: str, code: str, db: Session = Depends(get_db)):
    if verification_codes.get(email) != code:
        raise HTTPException(status_code=400, detail="인증번호가 일치하지 않습니다.")
    
    existing_user = db.query(models.User).filter(models.User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 존재하는 계정입니다.")
    
    new_user = models.User(
        email=email,
        hashed_password=password,
        name=name,
        points=0
    )
    db.add(new_user)
    db.commit()
    return {"message": "회원가입이 완료되었습니다.", "status": "success"}

# (4) 로그인
@app.post("/api/auth/login")
def login(email: str, password: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or user.hashed_password != password:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 틀렸습니다.")
    return {
        "user_id": user.id,
        "name": user.name,
        "points": user.points,
        "status": "success"
    }

# (5) 노선 조회 및 예약
@app.get("/api/routes")
def get_all_routes(db: Session = Depends(get_db)):
    return db.query(models.BusRoute).all()

@app.post("/api/bookings/reserve")
def reserve_bus(route_id: int, user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if user.points < 3000:
        raise HTTPException(status_code=400, detail="포인트가 부족합니다. (3,000P 필요)")
    
    user.points -= 3000
    new_booking = models.Booking(user_id=user_id, route_id=route_id, booked_at=datetime.datetime.now())
    db.add(new_booking)
    db.commit()
    return {"message": "예약 완료", "status": "success", "remaining_points": user.points}

# (6) 내 정보 조회
@app.get("/api/auth/me")
@app.get("/api/user/status")
def get_user_status(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return {
        "user_id": user.id,
        "name": user.name,
        "points": user.points,
        "email": user.email
    }

# (7) 포인트 충전
@app.post("/api/points/charge")
@app.post("/api/charge/request")
def charge_points(request: ChargeRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    user.points += request.amount
    db.commit()
    return {"message": f"{request.amount}포인트가 충전되었습니다.", "points": user.points, "status": "success"}
