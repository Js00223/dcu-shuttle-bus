from fastapi import FastAPI, Depends, HTTPException, Request, Response, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from email.mime.text import MIMEText
import models, utils, datetime, database, random, smtplib, time, traceback
from database import SessionLocal, engine
from fastapi.responses import JSONResponse

# 데이터베이스 테이블 생성
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# --- [1. CORS & ngrok 설정] ---
# Vercel(프론트)에서 ngrok(백엔드)으로 요청을 보낼 때 발생하는 보안 차단을 해제합니다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 실제 서비스 시에는 Vercel 주소만 넣는 것이 안전합니다.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    # ngrok 프리뷰 페이지를 건너뛰기 위한 헤더 추가 및 OPTIONS 처리
    if request.method == "OPTIONS":
        return Response(status_code=200, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        })
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    # ngrok-skip-browser-warning 헤더는 프론트엔드 axios 설정에 추가하는 것이 더 좋습니다.
    return response

# --- [2. 공통 설정 및 DTO] ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class SignupRequest(BaseModel):
    email: str
    code: str
    password: str
    name: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ChargeRequest(BaseModel):
    amount: int

# 전역 변수 유지
verification_codes = {}
pending_payments = {}
BANKS = ["대구은행", "신한은행", "국민은행", "우리은행", "카카오뱅크"]

# --- [3. 핵심 인증 API] ---

@app.get("/")
def read_root():
    return {"status": "online", "message": "DCU Shuttle API Server (Vercel Linked)"}

def is_cu_email(email: str):
    return email.endswith("@cu.ac.kr")

def send_real_email(receiver_email: str, code: str):
    smtp_server = "smtp.gmail.com"
    smtp_port = 587
    sender_email = "j020218hh@gmail.com" 
    sender_password = "heyxdsgbbzjtmngc" 
    msg = MIMEText(f"대구가톨릭대 셔틀 서비스 인증번호는 [{code}] 입니다.")
    msg['Subject'] = "DCU 셔틀 서비스 인증 메일"
    msg['From'] = sender_email
    msg['To'] = receiver_email
    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"❌ 메일 발송 에러: {e}")
        return False

@app.post("/api/auth/send-code")
def send_code(email: str):
    if not is_cu_email(email):
        raise HTTPException(status_code=400, detail="대학교 메일만 사용 가능합니다.")
    code = str(random.randint(100000, 999999))
    verification_codes[email] = code
    print(f"📧 인증번호 생성: {email} -> {code}")
    if send_real_email(email, code):
        return {"status": "success", "message": "인증번호 발송 완료"}
    return {"status": "error", "message": "발송 실패"}

@app.post("/api/auth/signup")
def signup(data: SignupRequest = Body(...), db: Session = Depends(get_db)):
    print(f"📥 [Vercel Request] 가입 시도: {data.email}")
    try:
        # 1. 중복 가입 체크 (IntegrityError 방지)
        existing_user = db.query(models.User).filter(models.User.email == data.email).first()
        if existing_user:
            print(f"⚠️ 가입 거절: 이미 존재하는 이메일 ({data.email})")
            raise HTTPException(status_code=400, detail="이미 가입된 이메일입니다.")

        # 2. 인증번호 검증
        saved_code = verification_codes.get(data.email)
        if not saved_code or str(saved_code) != str(data.code):
            raise HTTPException(status_code=400, detail="인증번호가 틀렸거나 만료되었습니다.")
        
        # 3. 유저 생성
        new_user = models.User(
            email=data.email, 
            hashed_password=data.password, 
            name=data.name, 
            points=0
        )
        db.add(new_user)
        db.commit()
        
        if data.email in verification_codes:
            del verification_codes[data.email]
            
        return {"status": "success", "message": "회원가입 완료"}

    except HTTPException as e:
        raise e
    except Exception as e:
        db.rollback()
        print(f"💥 서버 에러 상세:\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=500, 
            content={"detail": "서버 내부 오류로 가입에 실패했습니다."}
        )

@app.post("/api/auth/login")
def login(data: LoginRequest = Body(...), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or user.hashed_password != data.password:
        raise HTTPException(status_code=401, detail="로그인 정보 오류")
    return {
        "status": "success",
        "token": f"fake-jwt-{user.id}",
        "user": {"id": user.id, "name": user.name, "points": user.points}
    }

# --- [4. 유저 및 예약 API] ---

@app.get("/api/user/status")
def get_user_status(user_id: int = 1, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404)
    return {
        "points": user.points,
        "name": user.name,
        "studentId": "20231234",
        "phone": "010-0000-0000"
    }

@app.post("/api/charge/request")
def request_charge(request: ChargeRequest = Body(...), user_id: int = 1):
    payment_id = f"PAY-{random.randint(1000, 9999)}"
    expire_at = datetime.datetime.now() + datetime.timedelta(minutes=3)
    bank_info = f"{random.choice(BANKS)} {random.randint(100,999)}-{random.randint(10,99)}-{random.randint(1000,9999)}"
    pending_payments[payment_id] = {"amount": request.amount, "user_id": user_id, "expire_at": expire_at}
    return {
        "payment_id": payment_id,
        "amount": request.amount,
        "account": f"{bank_info} (예금주: DCU셔틀)"
    }

@app.get("/api/routes")
def get_routes(db: Session = Depends(get_db)):
    return db.query(models.BusRoute).all()

@app.post("/api/bookings/reserve")
def reserve_bus(route_id: int, user_id: int = 1, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or user.points < 3000: 
        raise HTTPException(status_code=400, detail="포인트 부족 또는 유저 없음")
    
    user.points -= 3000
    new_booking = models.Booking(user_id=user_id, route_id=route_id, booked_at=datetime.datetime.now())
    db.add(new_booking)
    db.commit()
    return {"status": "success", "remaining_points": user.points}
