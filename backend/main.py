import os
import random
import datetime
import logging
import base64
import re
import math
import requests
from typing import List, Optional, Dict
from email.mime.text import MIMEText

from fastapi import FastAPI, Depends, HTTPException, status, Body, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import uvicorn

# 프로젝트 내부 모듈
import models
from database import engine, get_db

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# --- [환경 변수 및 전역 변수 설정] ---
GMAIL_CLIENT_ID = os.getenv("GMAIL_CLIENT_ID")
GMAIL_CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET")
GMAIL_REFRESH_TOKEN = os.getenv("GMAIL_REFRESH_TOKEN")
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY")

# 인증번호 저장소 및 대기열 (실제 운영 시 Redis 등을 사용하는 것이 좋음)
verification_codes: Dict[str, str] = {}
waiting_list: Dict[int, List[int]] = {}

# --- [Pydantic 데이터 모델] ---
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
    code: str

class MessageCreate(BaseModel):
    sender_id: int
    receiver_id: int
    title: str
    content: str

class DeleteAccountRequest(BaseModel):
    user_id: int
    password: str

class FavoriteToggleRequest(BaseModel):
    user_id: int
    route_id: int

class ReserveRequest(BaseModel):
    user_id: Optional[int] = None
    route_id: Optional[int] = None

class WaitingRequest(BaseModel):
    user_id: int
    route_id: int

class CancelReservationRequest(BaseModel):
    user_id: int
    booking_id: int
    route_id: int

# --- [유틸리티 함수] ---
def get_haversine_distance(origin_str: str, dest_str: str):
    """카카오 API 실패 시 직선 거리를 계산하는 보조 함수"""
    try:
        lon1, lat1 = map(float, origin_str.split(','))
        lon2, lat2 = map(float, dest_str.split(','))
        R = 6371  # 지구 반지름 (km)
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = math.sin(d_lat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        distance = R * c
        duration = math.ceil((distance / 35) * 60) + 2
        return round(distance, 1), duration
    except Exception as e:
        logger.error(f"Haversine Error: {e}")
        return 0.0, 0

def send_real_email(receiver_email: str, code: str):
    try:
        if not all([GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN]):
            logger.error("Gmail API 환경변수 누락")
            return False
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        from google.auth.transport.requests import Request
        
        creds = Credentials(
            None, 
            refresh_token=GMAIL_REFRESH_TOKEN, 
            token_uri="https://oauth2.googleapis.com/token", 
            client_id=GMAIL_CLIENT_ID, 
            client_secret=GMAIL_CLIENT_SECRET
        )
        if not creds.valid:
            creds.refresh(Request())
        
        service = build('gmail', 'v1', credentials=creds)
        message = MIMEText(f"안녕하세요. 대구가톨릭대 셔틀 서비스 인증번호는 [{code}] 입니다.")
        message['to'] = receiver_email
        message['from'] = "me"
        message['subject'] = "[대구가톨릭대] 본인확인 인증번호"
        
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
        service.users().messages().send(userId="me", body={'raw': raw}).execute()
        return True
    except Exception as e:
        logger.error(f"Email Error: {e}")
        return False

# --- [Middleware] ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    models.Base.metadata.create_all(bind=engine)

# --- [API 엔드포인트] ---

@app.get("/")
def root():
    return {"status": "running", "message": "DCU Shuttle API"}

@app.get("/api/shuttle/precise-eta")
async def get_precise_eta(origin: str, destination: str):
    if not KAKAO_REST_API_KEY:
        dist, dur = get_haversine_distance(origin, destination)
        return {"status": "fallback", "duration_min": dur, "distance_km": dist}

    url = "https://apis-navi.kakaomobility.com/v1/directions"
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {"origin": origin, "destination": destination, "priority": "TIME"}
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=5)
        data = response.json()
        
        if response.status_code != 200 or "routes" not in data or not data['routes']:
            dist, dur = get_haversine_distance(origin, destination)
            return {"status": "fallback", "duration_min": dur, "distance_km": dist, "message": "직선거리 대체"}
            
        summary = data['routes'][0]['summary']
        return {
            "status": "success",
            "duration_min": math.ceil(summary['duration'] / 60),
            "distance_km": round(summary['distance'] / 1000, 1)
        }
    except:
        dist, dur = get_haversine_distance(origin, destination)
        return {"status": "error_fallback", "duration_min": dur, "distance_km": dist}

# 노선 상세 조회 (프론트 동적 이름 표시용)
@app.get("/api/routes/{route_id}")
def get_route_detail(route_id: int, db: Session = Depends(get_db)):
    route = db.query(models.BusRoute).filter(models.BusRoute.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="노선을 찾을 수 없습니다.")
    return route

@app.get("/api/routes")
def get_routes(db: Session = Depends(get_db)):
    return db.query(models.BusRoute).all()

@app.post("/api/auth/send-code")
def send_code(email: str):
    if not email.endswith("@cu.ac.kr"):
        raise HTTPException(status_code=400, detail="학교 메일만 가능합니다.")
    code = str(random.randint(100000, 999999))
    verification_codes[email] = code
    if send_real_email(email, code):
        return {"status": "success", "message": "인증번호 발송 완료"}
    return {"status": "success", "test_code": code, "message": "메일 발송 실패로 테스트 코드 반환"}

@app.post("/api/auth/login")
def login(email: str, password: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or user.hashed_password != password:
        raise HTTPException(status_code=401, detail="인증 실패")
    favs = [f.route_id for f in db.query(models.Favorite).filter(models.Favorite.user_id == user.id).all()]
    return {"user_id": user.id, "name": user.name, "points": user.points, "favorites": favs, "status": "success"}

@app.post("/api/bookings/reserve")
def reserve(user_id: int, route_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    route = db.query(models.BusRoute).filter(models.BusRoute.id == route_id).first()
    if not user or not route:
        raise HTTPException(status_code=404, detail="정보 없음")
    
    cost = 3000 if any(k in route.route_name for k in ["경주", "울산", "포항"]) else 0
    if user.points < cost:
        raise HTTPException(status_code=400, detail="포인트 부족")
    
    user.points -= cost
    db.add(models.Booking(user_id=user_id, route_id=route_id, status="reserved"))
    db.commit()
    return {"status": "success", "remaining": user.points}

@app.get("/api/messages")
def get_msgs(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Message).filter(models.Message.receiver_id == user_id).all()

# --- [서버 실행] ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
