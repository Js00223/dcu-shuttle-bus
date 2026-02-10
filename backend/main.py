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

# 프로젝트 내부 모듈 (models.py, database.py 확인 필요)
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

verification_codes: Dict[str, str] = {}

# --- [Pydantic 모델] ---
class WaitingRequest(BaseModel):
    user_id: int
    route_id: int

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
def root(): return {"status": "running"}

# ✅ 404 해결: 유저 상태 조회
@app.get("/api/user/status")
def get_status(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    favs = [f.route_id for f in db.query(models.Favorite).filter(models.Favorite.user_id == user.id).all()]
    return {"user_id": user.id, "name": user.name, "points": user.points, "favorites": favs, "status": "success"}

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

@app.post("/api/auth/login")
def login(email: str = Body(...), password: str = Body(...), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or user.hashed_password != password: raise HTTPException(status_code=401)
    return {"user_id": user.id, "name": user.name, "points": user.points, "status": "success"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
