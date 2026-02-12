import os
import random
import datetime
import logging
import base64
import math
import requests
from typing import List, Optional, Dict
from email.mime.text import MIMEText

from fastapi import FastAPI, Depends, HTTPException, status, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uvicorn

# 프로젝트 내부 모듈 (models.py, database.py가 동일 경로에 있어야 함)
import models
from database import engine, get_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ✅ 데이터 수신을 위한 스키마 정의
class DeleteAccountRequest(BaseModel):
    user_id: int

app = FastAPI()

# --- [환경 변수] ---
GMAIL_CLIENT_ID = os.getenv("GMAIL_CLIENT_ID")
GMAIL_CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET")
GMAIL_REFRESH_TOKEN = os.getenv("GMAIL_REFRESH_TOKEN")
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY")

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

# --- [유틸리티] ---
def get_haversine_distance(origin_str: str, dest_str: str):
    try:
        lon1, lat1 = map(float, origin_str.split(','))
        lon2, lat2 = map(float, dest_str.split(','))
        R = 6371
        d_lat, d_lon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
        a = math.sin(d_lat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        dist = R * c
        return round(dist, 1), math.ceil((dist/35)*60)+2
    except: return 0.0, 0

# --- [API 엔드포인트] ---

@app.get("/")
def root(): 
    return {"status": "running", "message": "DCU Shuttle API Server"}

# ✅ 로그인
@app.post("/api/auth/login")
def login(
    email: str = Query(...), 
    password: str = Query(...), 
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or user.hashed_password != password:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 잘못되었습니다.")
    
    favs = [f.route_id for f in db.query(models.Favorite).filter(models.Favorite.user_id == user.id).all()]
    return {
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "points": user.points,
        "phone": getattr(user, 'phone', "연락처 미등록"),
        "favorites": favs,
        "status": "success"
    }

# ✅ 비밀번호 변경을 위한 인증번호 발송 (엔드포인트 이름을 send-code로 수정)
@app.post("/api/auth/send-code")
def send_verification_code(
    email: str = Query(...),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="가입되지 않은 이메일입니다.")
    
    # 6자리 랜덤 인증번호 생성
    code = str(random.randint(100000, 999999))
    
    logger.info(f"Verification code for {email}: {code}")
    
    return {
        "status": "success",
        "message": "인증 번호가 발송되었습니다.",
        "verification_code": code
    }

# ✅ 유저 상태 조회
@app.get("/api/user/status")
def get_status(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    favs = [f.route_id for f in db.query(models.Favorite).filter(models.Favorite.user_id == user.id).all()]
    return {
        "user_id": user.id, 
        "name": user.name, 
        "email": user.email,
        "points": user.points, 
        "phone": getattr(user, 'phone', "연락처 미등록"),
        "favorites": favs, 
        "status": "success"
    }

# ✅ 회원 탈퇴 기능
@app.post("/api/auth/delete-account")
def delete_account(
    req: DeleteAccountRequest,
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    # 연관 데이터 삭제
    db.query(models.Favorite).filter(models.Favorite.user_id == req.user_id).delete()
    db.query(models.Booking).filter(models.Booking.user_id == req.user_id).delete()
    db.query(models.Message).filter((models.Message.sender_id == req.user_id) | (models.Message.receiver_id == req.user_id)).delete()
    
    db.delete(user)
    db.commit()
    return {"status": "success", "message": "계정이 삭제되었습니다."}

# ✅ 포인트 충전 기능
@app.post("/api/user/charge")
def charge_points(
    user_id: int = Query(...), 
    amount: int = Query(...), 
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    user.points += amount
    db.commit()
    return {"status": "success", "new_balance": user.points}

# ✅ 쪽지 목록 조회
@app.get("/api/messages")
def get_messages(user_id: int, db: Session = Depends(get_db)):
    msgs = db.query(models.Message).filter(models.Message.receiver_id == user_id).all()
    return [{
        "id": m.id,
        "title": m.title,
        "content": m.content,
        "sender_id": m.sender_id,
        "created_at": m.created_at
    } for m in msgs]

# ✅ 실시간 도착 정보
@app.get("/api/shuttle/precise-eta")
async def get_precise_eta(origin: str, destination: str):
    if not KAKAO_REST_API_KEY:
        d, t = get_haversine_distance(origin, destination)
        return {"status": "fallback", "duration_min": t, "distance_km": d}
    
    url = "https://apis-navi.kakaomobility.com/v1/directions"
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    try:
        res = requests.get(url, headers=headers, params={"origin":origin, "destination":destination, "priority":"TIME"}, timeout=5)
        data = res.json()
        if res.status_code != 200 or "routes" not in data or not data['routes']:
            d, t = get_haversine_distance(origin, destination)
            return {"status": "fallback", "duration_min": t, "distance_km": d}
        s = data['routes'][0]['summary']
        return {"status": "success", "duration_min": math.ceil(s['duration']/60), "distance_km": round(s['distance']/1000, 1)}
    except:
        d, t = get_haversine_distance(origin, destination)
        return {"status": "error", "duration_min": t, "distance_km": d}

# ✅ 노선 조회 API들
@app.get("/api/routes")
def get_routes(db: Session = Depends(get_db)):
    return db.query(models.BusRoute).all()

@app.get("/api/routes/{route_id}")
def get_route_detail(route_id: int, db: Session = Depends(get_db)):
    route = db.query(models.BusRoute).filter(models.BusRoute.id == route_id).first()
    if not route: raise HTTPException(status_code=404, detail="Route not found")
    return route

# ✅ 예약 및 즐겨찾기 토글
@app.post("/api/bookings/reserve")
def reserve(user_id: int = Query(...), route_id: int = Query(...), db: Session = Depends(get_db)):
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
    return {"status": "success", "remaining_points": user.points}

@app.post("/api/user/favorite-toggle")
def toggle_favorite(user_id: int = Query(...), route_id: int = Query(...), db: Session = Depends(get_db)):
    fav = db.query(models.Favorite).filter(models.Favorite.user_id == user_id, models.Favorite.route_id == route_id).first()
    if fav:
        db.delete(fav)
        action = "removed"
    else:
        db.add(models.Favorite(user_id=user_id, route_id=route_id))
        action = "added"
    db.commit()
    return {"status": "success", "action": action}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
