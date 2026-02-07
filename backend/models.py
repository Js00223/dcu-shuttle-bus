from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base  # database.py에 정의된 Base를 사용해야 합니다.
from sqlalchemy.sql import func

# User 테이블
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    name = Column(String)
    phone = Column(String, nullable=True) # main.py에서 phone을 사용하므로 추가
    points = Column(Integer, default=0)

# BusRoute 테이블
class BusRoute(Base):
    __tablename__ = "bus_routes"
    
    id = Column(Integer, primary_key=True, index=True)
    route_name = Column(String)      # 전체 명칭 (예: 하양역 방면)
    location = Column(String)        # 장소 (예: 안심역)
    time = Column(String, nullable=True) # 시간
    total_seats = Column(Integer, default=45)

    current_lat = Column(Float, nullable=True)  # 현재 위도
    current_lng = Column(Float, nullable=True)  # 현재 경도
    last_updated = Column(DateTime, default=datetime.now) 
    is_running = Column(Integer, default=0) # 0: 운행전, 1: 운행중

# ★ 즐겨찾기 테이블 (이게 없어서 에러가 났었습니다!) ★
class Favorite(Base):
    __tablename__ = "favorites"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    route_id = Column(Integer, ForeignKey("bus_routes.id"))

# Booking 테이블
class Booking(Base):
    __tablename__ = "bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    route_id = Column(Integer, ForeignKey("bus_routes.id"))
    status = Column(String, default="reserved") # main.py 호환을 위해 추가
    seat_number = Column(Integer, nullable=True)
    booked_at = Column(DateTime, default=datetime.now)
    
    user = relationship("User")
    route = relationship("BusRoute")

# SemesterPass 테이블
class SemesterPass(Base):
    __tablename__ = "semester_passes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    route_type = Column(String) 
    status = Column(String, default="pending") 
    applied_at = Column(DateTime, default=datetime.now)

# Message 테이블
class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    receiver_id = Column(Integer, ForeignKey("users.id")) 
    title = Column(String)
    content = Column(Text)
    is_read = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
