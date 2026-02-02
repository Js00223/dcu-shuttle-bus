import random
import datetime
import logging
from typing import List
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

# 내가 만든 파일들 임포트
import models
from database import engine, get_db

# 로깅 설정 (Render 터미널 로그 출력용)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- [중요] FastAPI 앱 객체 생성 (항상 위쪽에 위치) ---
app = FastAPI()

# --- [1. 서버 시작 시 실행 로직] ---
@app.on_event("startup")
def startup_event():
    logger.info("🚀 서버 기동 중: 데이터베이스 연결 확인...")
    try:
        # DB 테이블 자동 생성
        models.Base.metadata.create_all(bind=engine)
        
        # 연결 테스트 쿼리
        with engine.connect() as connection:
            result = connection.execute(text("SELECT NOW();")).fetchone()
            logger.info(f"✅ DB 연결 성공! 시간: {result[0]}")
    except Exception as e:
        logger.error(f"❌ DB 연결 실패: {e}")

# --- [2. CORS 설정] ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- [3. 임시 데이터 스토어] ---
verification_codes = {}

# --- [4. API 엔드포인트] ---

# (1) 인증번호 발송
@app.post("/api/auth/send-code")
def send_verification_code(email: str):
    if not email.endswith("@cu.ac.kr"):
        raise HTTPException(status_code=400, detail="대구가톨릭대 메일만 가능합니다.")
    code = str(random.randint(100000, 999999))
    verification_codes[email] = code
    print(f"📧 [메일 발송] To: {email} | Code: {code}")
    return {"message": "인증번호가 발송되었습니다."}

# (2) 회원가입
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

# (3) 로그인
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

# (4) 노선 조회 및 예약
@app.get("/api/routes")
def get_all_routes(db: Session = Depends(get_db)):
    return db.query(models.BusRoute).all()

@app.post("/bookings/reserve")
def reserve_bus(route_id: int, user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or user.points < 3000:
        raise HTTPException(status_code=400, detail="포인트가 부족하거나 유저를 찾을 수 없습니다.")
    
    user.points -= 3000
    new_booking = models.Booking(user_id=user_id, route_id=route_id, booked_at=datetime.datetime.now())
    db.add(new_booking)
    db.commit()
    return {"message": "예약 완료"}
# main.py 에 아래 내용들을 추가하거나 덮어쓰세요
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

@app.post("/api/charge/request")
def charge_points(user_id: int, amount: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    # 실제로는 결제 검증 로직이 들어가야 함 (현재는 바로 충전)
    user.points += amount
    db.commit()
    return {"message": f"{amount}포인트가 충전되었습니다.", "current_points": user.points}
