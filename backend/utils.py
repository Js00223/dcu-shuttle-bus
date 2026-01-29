from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import models, utils, datetime, database, random
from database import SessionLocal, engine
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

# 테이블 생성
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB 세션 의존성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- [인증 데이터 스토어] ---
# 실제 서비스 시에는 Redis나 DB 테이블 사용 권장
verification_codes = {}

# --- [기능 1] 학교 메일 인증번호 발송 ---
@app.post("/auth/send-code")
def send_verification_code(email: str):
    if not email.endswith("@cu.ac.kr"):
        raise HTTPException(status_code=400, detail="대구가톨릭대 메일(@cu.ac.kr)만 가능합니다.")
    
    code = str(random.randint(100000, 999999))
    verification_codes[email] = code
    
    # 실제 메일 발송 로직 대신 터미널 출력으로 대체 (테스트용)
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
        hashed_password=password, # 실제로는 해싱 권장
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

# --- [기존 노선 및 예약 API] ---
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