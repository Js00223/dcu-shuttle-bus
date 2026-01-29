from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, utils, datetime, database, random, smtplib
from database import SessionLocal, engine
from fastapi.middleware.cors import CORSMiddleware
from email.mime.text import MIMEText

# 데이터베이스 테이블 생성
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# 프론트엔드 통신을 위한 CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB 세션 의존성 함수
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- [인증 관련 변수 및 유틸리티] ---

# 이메일 인증 코드를 임시 저장하는 메모리 저장소
verification_codes = {}

def is_cu_email(email: str):
    """학교 도메인 체크"""
    return email.endswith("@cu.ac.kr")

# --- [1. 인증 및 계정 관련 API] ---

@app.post("/auth/send-code")
def send_code(email: str):
    """인증번호 발송: @cu.ac.kr 체크 후 번호 생성"""
    if not is_cu_email(email):
        raise HTTPException(status_code=400, detail="대구가톨릭대학교 메일(@cu.ac.kr)만 사용 가능합니다.")
    
    code = str(random.randint(100000, 999999))
    verification_codes[email] = code
    
    # 서버 터미널에서 인증번호 확인용 (실제 메일 발송 전 단계)
    print(f"--- [인증번호 발송] {email} : {code} ---")
    
    return {"status": "success", "message": "인증번호가 발송되었습니다. 터미널을 확인하세요."}

@app.post("/auth/signup")
def signup(email: str, code: str, password: str, name: str, db: Session = Depends(get_db)):
    """회원가입: 인증코드 확인 후 유저 생성"""
    if verification_codes.get(email) != code:
        raise HTTPException(status_code=400, detail="인증번호가 일치하지 않습니다.")
    
    existing_user = db.query(models.User).filter(models.User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 가입된 이메일입니다.")

    new_user = models.User(
        email=email, 
        hashed_password=password, 
        name=name, 
        points=0
    )
    db.add(new_user)
    db.commit()
    
    if email in verification_codes:
        del verification_codes[email]
        
    return {"status": "success", "message": "회원가입이 완료되었습니다."}

@app.post("/auth/login")
def login(email: str, password: str, db: Session = Depends(get_db)):
    """로그인: 정보 확인 후 유저 정보 반환"""
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or user.hashed_password != password:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 틀렸습니다.")
    
    return {
        "status": "success", 
        "user": {"id": user.id, "name": user.name, "email": user.email, "points": user.points}
    }

@app.post("/auth/reset-password")
def reset_password(email: str, code: str, new_password: str, db: Session = Depends(get_db)):
    """비밀번호 재설정: 인증 성공 시 비번 변경"""
    if verification_codes.get(email) != code:
        raise HTTPException(status_code=400, detail="인증번호가 일치하지 않습니다.")
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    user.hashed_password = new_password
    db.commit()
    
    if email in verification_codes:
        del verification_codes[email]
        
    return {"status": "success", "message": "비밀번호가 변경되었습니다."}

# --- [2. 버스 및 노선 관련 API] ---

@app.get("/routes")
def get_all_routes(db: Session = Depends(get_db)):
    """전체 버스 노선 목록 조회"""
    return db.query(models.BusRoute).all()

@app.post("/bus/update-location")
def update_bus_location(route_id: int, lat: float, lng: float, db: Session = Depends(get_db)):
    """실시간 버스 위치 업데이트 (운행 중 상태로 변경)"""
    bus = db.query(models.BusRoute).filter(models.BusRoute.id == route_id).first()
    if bus:
        bus.current_lat = lat
        bus.current_lng = lng
        bus.last_updated = datetime.datetime.now()
        bus.is_running = 1
        db.commit()
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="노선을 찾을 수 없습니다.")

@app.get("/bus/track/{route_id}")
def track_bus(route_id: int, user_lat: float, user_lng: float, db: Session = Depends(get_db)):
    """버스 위치 추적 및 ETA 계산"""
    bus = db.query(models.BusRoute).filter(models.BusRoute.id == route_id).first()
    if not bus or bus.current_lat is None:
        return {"status": "error", "message": "차량 위치 정보를 사용할 수 없습니다."}

    # utils.py에 작성된 하버사인 ETA 로직 호출
    eta_info = utils.calculate_eta(user_lat, user_lng, bus.current_lat, bus.current_lng)
    return {
        "route_name": bus.route_name,
        "bus_location": {"lat": bus.current_lat, "lng": bus.current_lng},
        "distance": eta_info["distance_km"],
        "eta": eta_info["eta_minutes"],
        "last_updated": bus.last_updated
    }

# --- [3. 예약 및 포인트 관련 API] ---

@app.post("/bookings/reserve")
def reserve_bus(route_id: int, user_id: int = 1, db: Session = Depends(get_db)):
    """버스 예약 및 포인트 3,000P 차감"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    if user.points < 3000:
        return {"status": "error", "message": "포인트가 부족합니다."}

    user.points -= 3000
    new_booking = models.Booking(
        user_id=user_id,
        route_id=route_id,
        booked_at=datetime.datetime.now(),
        seat_number=random.randint(1, 45) # 랜덤 좌석 배정
    )
    db.add(new_booking)

    # 자동 쪽지 발송
    bus = db.query(models.BusRoute).filter(models.BusRoute.id == route_id).first()
    new_msg = models.Message(
        user_id=user_id,
        title="예약 완료",
        content=f"[{bus.route_name}] 예약 완료! 3,000P가 차감되었습니다.",
        is_read=False,
        created_at=datetime.datetime.now()
    )
    db.add(new_msg)
    
    db.commit()
    return {"status": "success", "remaining_points": user.points}

@app.post("/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: int, db: Session = Depends(get_db)):
    """예약 취소 및 포인트 3,000P 환불"""
    # 실제 운영 시에는 booking_id로 실제 데이터를 조회해야 함
    user_id = 1 
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        user.points += 3000
        new_msg = models.Message(
            user_id=user_id,
            title="환불 완료",
            content="예약 취소로 3,000P가 환불되었습니다.",
            is_read=False,
            created_at=datetime.datetime.now()
        )
        db.add(new_msg)
        db.commit()
        return {"status": "success", "message": "환불 완료"}
    raise HTTPException(status_code=404, detail="환불 실패")

@app.get("/messages/{user_id}")
def get_messages(user_id: int, db: Session = Depends(get_db)):
    """사용자별 쪽지함 조회"""
    return db.query(models.Message).filter(models.Message.user_id == user_id).order_by(models.Message.created_at.desc()).all()
def send_real_email(receiver_email: str, code: str):
    """실제 Gmail을 통해 인증번호를 발송하는 함수"""
    smtp_server = "smtp.gmail.com"
    smtp_port = 587
    sender_email = "j020218hh@gmail.com" # 여기에 본인 메일 주소
    sender_password = "앱비밀번호16자리"      # 구글에서 생성한 앱 비밀번호

    msg = MIMEText(f"대구가톨릭대 셔틀 서비스 인증번호는 [{code}] 입니다.")
    msg['Subject'] = "DCU 셔틀 서비스 인증 메일"
    msg['From'] = sender_email
    msg['To'] = receiver_email

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls() # 보안 연결
            server.login(sender_email, sender_password)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"메일 발송 에러: {e}")
        return False

# --- 기존 send_code API 내부 수정 ---
@app.post("/auth/send-code")
def send_code(email: str):
    if not is_cu_email(email):
        raise HTTPException(status_code=400, detail="대구가톨릭대학교 메일(@cu.ac.kr)만 사용 가능합니다.")
    
    code = str(random.randint(100000, 999999))
    verification_codes[email] = code
    
    # 여기서 실제 메일 발송 함수 호출!
    success = send_real_email(email, code)
    
    if success:
        return {"status": "success", "message": "인증번호가 메일로 발송되었습니다."}
    else:
        # 실패하더라도 테스트를 위해 터미널엔 출력해줌
        print(f"⚠️ 메일 발송 실패! 터미널 확인: {code}")
        return {"status": "error", "message": "메일 발송 실패 (터미널 로그 확인)"}