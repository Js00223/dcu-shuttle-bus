from fastapi import FastAPI, Depends, HTTPException, Request, Response, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from email.mime.text import MIMEText
import models, utils, datetime, database, random, smtplib, time, traceback
from database import SessionLocal, engine
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# 데이터베이스 테이블 생성
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# --- [1. CORS & OPTIONS 설정] ---
@app.middleware("http")
async def add_cors_and_options_handler(request: Request, call_next):
    if request.method == "OPTIONS":
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Credentials": "true",
            },
        )
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# --- [2. 공통 설정 및 DTO 정의] ---
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

class PhoneUpdateRequest(BaseModel):
    phone: str

pending_payments = {}
BANKS = ["대구은행", "신한은행", "국민은행", "우리은행", "카카오뱅크"]
verification_codes = {}

# --- [3. 기본 경로 및 인증 API] ---

@app.get("/")
def read_root():
    return {"status": "online", "message": "DCU Shuttle API Server"}

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
        print(f"메일 발송 에러: {e}")
        return False

@app.post("/api/auth/send-code")
def send_code(email: str):
    if not is_cu_email(email):
        raise HTTPException(status_code=400, detail="대학교 메일만 사용 가능합니다.")
    code = str(random.randint(100000, 999999))
    verification_codes[email] = code
    print(f"인증번호 생성: {email} -> {code}")
    if send_real_email(email, code):
        return {"status": "success", "message": "인증번호 발송 완료"}
    return {"status": "error", "message": "발송 실패"}

# [핵심 수정] Body(...)를 명시하여 쿼리 파라미터가 아닌 JSON Body로 인식하게 함
@app.post("/api/auth/signup")
def signup(data: SignupRequest = Body(...), db: Session = Depends(get_db)):
    # 1. 인증번호 검증
    if verification_codes.get(data.email) != data.code:
        raise HTTPException(status_code=400, detail="인증번호 불일치")
    
    # 2. 유저 생성
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
        
    return {"status": "success"}

# [핵심 수정] 로그인도 Body로 수신하도록 수정
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

# --- [4. 유저 및 충전 API] ---
@app.get("/api/user/status")
def get_user_status(user_id: int = 1, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404)
    return {
        "points": user.points,
        "hasSemesterPass": getattr(user, 'has_pass', False),
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
        "expire_at": expire_at.isoformat(),
        "account": f"{bank_info} (예금주: DCU셔틀)"
    }

@app.post("/api/charge/confirm/{payment_id}")
def confirm_charge(payment_id: str, db: Session = Depends(get_db)):
    pay = pending_payments.get(payment_id)
    if not pay or datetime.datetime.now() > pay["expire_at"]:
        raise HTTPException(status_code=400, detail="유효하지 않은 요청")
    user = db.query(models.User).filter(models.User.id == pay["user_id"]).first()
    user.points += pay["amount"]
    db.commit()
    del pending_payments[payment_id]
    return {"status": "success", "new_points": user.points}

# --- [5. 버스 트래킹 및 예약 API] ---
@app.get("/api/routes")
def get_routes(db: Session = Depends(get_db)):
    return db.query(models.BusRoute).all()

@app.get("/api/bus/track/{route_id}")
def track_bus(route_id: int, user_lat: float, user_lng: float, db: Session = Depends(get_db)):
    bus = db.query(models.BusRoute).filter(models.BusRoute.id == route_id).first()
    if not bus:
        raise HTTPException(status_code=404, detail="해당 노선 없음")
    
    lat = bus.current_lat if bus.current_lat else 35.85
    lng = bus.current_lng if bus.current_lng else 128.56
    
    try:
        eta_info = utils.calculate_eta(user_lat, user_lng, lat, lng)
        return {
            "route_name": bus.route_name,
            "bus_location": {"lat": lat, "lng": lng},
            "eta": eta_info["eta_minutes"]
        }
    except Exception:
        return {
            "route_name": bus.route_name,
            "bus_location": {"lat": lat, "lng": lng},
            "eta": 0
        }

@app.post("/api/bookings/reserve")
def reserve_bus(route_id: int, user_id: int = 1, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="유저 없음")
    if user.points < 3000: raise HTTPException(status_code=400, detail="포인트 부족")
    
    user.points -= 3000
    new_booking = models.Booking(user_id=user_id, route_id=route_id, booked_at=datetime.datetime.now())
    db.add(new_booking)
    db.commit()
    return {"status": "success", "remaining_points": user.points}
