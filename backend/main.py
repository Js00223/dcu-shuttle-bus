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

# 프로젝트 내부 모듈 (models.py, database.py)
import models
from database import engine, get_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
def root(): return {"status": "running"}

# ✅ 유저 상태 조회 (404 방지)
@app.get("/api/user/status")
def get_status(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    favs = [f.route_id for f in db.query(models.Favorite).filter(models.Favorite.user_id == user.id).all()]
    return {"user_id": user.id, "name": user.name, "points": user.points, "favorites": favs, "status": "success"}

# ✅ 쪽지 목록 조회 (404 해결)
@app.get("/api/messages")
def get_messages(user_id: int, db: Session = Depends(get_db)):
    msgs = db.query(models.Message).filter(models.Message.receiver_id == user_id).all()
    # Pydantic 모델 변환 대신 딕셔너리 리스트로 반환
    return [{
        "id": m.id,
        "title": m.title,
        "content": m.content,
        "sender_id": m.sender_id,
        "created_at": m.created_at
    } for m in msgs]

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

@app.get("/api/routes")
def get_routes(db: Session = Depends(get_db)):
    return db.query(models.BusRoute).all()

@app.get("/api/routes/{route_id}")
def get_route_detail(route_id: int, db: Session = Depends(get_db)):
    route = db.query(models.BusRoute).filter(models.BusRoute.id == route_id).first()
    if not route: raise HTTPException(status_code=404)
    return route

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
