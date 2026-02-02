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

# --- [1. CORS 및 ngrok 연동 미들웨어] ---
# Vercel에서 오는 모든 요청을 허용하고, ngrok 특유의 보안 차단을 우회합니다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

@app.middleware("http")
async def add_ngrok_cors_middleware(request: Request, call_next):
    # 1. 브라우저의 사전 요청(OPTIONS)에 대해 즉시 200 응답 및 헤더 부여
    if request.method == "OPTIONS":
        return Response(status_code=200, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        })
    
    # 2. 실제 요청 처리
    response = await call_next(request)
    
    # 3. 모든 응답 헤더에 CORS 허용 및 ngrok 경고 무시 헤더 강제 주입
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    # ngrok 프리뷰 페이지를 우회하도록 응답에도 헤더 설정 (브라우저 정책 대응)
    response.headers["ngrok-skip-browser-warning"] = "69420"
    
    return response

# --- [2. 데이터 모델] ---
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

# 임시 저장소
verification_codes = {}
pending_payments = {}
BANKS = ["대구은행", "신한은행", "국민은행", "우리은행", "카카오뱅크"]

# --- [3. 핵심 API 로직] ---

@app.get("/")
def read_root():
    return {"status": "online", "message": "DCU Shuttle API Server"}

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
    if not email.endswith("@cu.ac.kr"):
        raise HTTPException(status_code=400, detail="대학교 메일만 사용 가능합니다.")
    code = str(random.randint(100000, 999999))
    verification_codes[email] = code
    print(f"📧 인증번호 생성: {email} -> {code}")
    if send_real_email(email, code):
        return {"status": "success", "message": "인증번호 발송 완료"}
    return {"status": "error", "message": "발송 실패"}

@app.post("/api/auth/signup")
def signup(data: SignupRequest = Body(...), db: Session = Depends(get_db)):
    print(f"📥 가입 요청: {data.email}")
    try:
        # 1. 중복 이메일 체크 (IntegrityError 방지)
        existing_user = db.query(models.User).filter(models.User.email == data.email).first()
        if existing_user:
            print(f"⚠️ 중복 계정 가입 시도: {data.email}")
            return JSONResponse(status_code=400, content={"detail": "이미 가입된 이메일입니다."})

        # 2. 인증번호 검증
        saved_code = verification_codes.get(data.email)
        if not saved_code or str(saved_code) != str(data.code):
            return JSONResponse(status_code=400, content={"detail": "인증번호가 틀렸거나 만료되었습니다."})
        
        # 3. 유저 저장
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
            
        print(f"✅ 가입 성공: {data.email}")
        return {"status": "success", "message": "회원가입 완료"}

    except Exception as e:
        db.rollback()
        print(f"💥 서버 에러: {traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"detail": f"서버 오류: {str(e)}"})

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

# --- [4. 기타 서비스 API] ---

@app.get("/api/user/status")
def get_user_status(user_id: int = 1, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404)
    return {"points": user.points, "name": user.name}

@app.get("/api/routes")
def get_routes(db: Session = Depends(get_db)):
    return db.query(models.BusRoute).all()
