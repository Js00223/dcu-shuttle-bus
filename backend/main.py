import os
import logging
import random
import datetime
import psycopg2
from typing import List
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

# 유저님이 작성한 다른 파일들 임포트
import models
import database
from database import SessionLocal, engine, get_db

# 로깅 설정 (Render 로그 확인용)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- [1. 서버 시작 시 DB 연결 확인 및 테이블 생성] ---
@app.on_event("startup")
def startup_event():
    logger.info("🚀 Starting up and checking Database connection...")
    try:
        # DB 테이블 생성 (database.py의 engine 사용)
        models.Base.metadata.create_all(bind=engine)
        logger.info("✅ Database tables created or already exist.")
        
        # 연결 테스트 (SELECT NOW)
        with engine.connect() as connection:
            result = connection.execute(text("SELECT NOW();")).fetchone()
            logger.info(f"✅ Connection successful! DB Time: {result[0]}")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- [인증 데이터 스토어] ---
verification_codes = {}

# --- [기능 1] 학교 메일 인증번호 발송 ---
@app.post("/auth/send-code")
def send_verification_code(email: str):
    if not email.endswith("@cu.ac.kr"):
        raise HTTPException(status_code=400, detail="대구가톨릭대 메일(@cu.ac.kr)만 가능합니다.")
    
    code = str(random.randint(100000, 999999))
    verification_codes[email] = code
    
    # 실제 서비스 시 여기서 smtplib 등을 이용해 메일을 발송합니다.
    print(f"📧 [메일 발송] To: {email} | Code: {code}")
    
    return {"message": "인증번호가 발송되었습니다."}

# --- [기능 2] 회원가입 ---
@app.post("/auth/signup")
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
    return {"message": "회원가입이 완료되었습니다."}

# --- [기능 3] 로그인 ---
@app.post("/auth/login")
def login(email: str, password: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or user.hashed_password != password:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 틀렸습니다.")
    
    return {
        "user_id": user.id,
        "name": user.name,
        "points": user.points
    }

# --- [기능 4] 비밀번호 재설정 ---
@app.post("/auth/reset-password")
def reset_password(email: str, new_password: str, code: str, db: Session = Depends(get_db)):
    if verification_codes.get(email) != code:
        raise HTTPException(status_code=400, detail="인증번호가 일치하지 않습니다.")
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    user.hashed_password = new_password
    db.commit()
    return {"message": "비밀번호가 성공적으로 변경되었습니다."}

# --- [노선 및 예약 API] ---
@app.get("/routes")
def get_all_routes(db: Session = Depends(get_db)):
    return db.query(models.BusRoute).all()

@app.post("/bookings/reserve")
def reserve_bus(route_id: int, user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or user.points < 3000:
        raise HTTPException(status_code=400, detail="포인트가 부족하거나 유저가 없습니다.")
    
    user.points -= 3000
    new_booking = models.Booking(user_id=user_id, route_id=route_id, booked_at=datetime.datetime.now())
    db.add(new_booking)
    db.commit()
    return {"message": "예약 완료"}

@app.get("/messages/{user_id}")
def get_messages(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Message).filter(models.Message.user_id == user_id).all()
