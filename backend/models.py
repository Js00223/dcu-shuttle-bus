from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base  # database.py에서 정의된 Base를 사용해야 합니다.
from sqlalchemy.sql import func

# 유저 정보
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    name = Column(String)
    phone = Column(String, nullable=True)
    points = Column(Integer, default=0)

# 셔틀 노선 정보
class BusRoute(Base):
    __tablename__ = "bus_routes"
    id = Column(Integer, primary_key=True, index=True)
    route_name = Column(String)      # 전체 명칭
    location = Column(String)        # 장소
    time = Column(String, nullable=True) 
    total_seats = Column(Integer, default=45)
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    last_updated = Column(DateTime, default=datetime.now)
    is_running = Column(Integer, default=0)

# ★ 누락되었던 즐겨찾기 모델 추가 ★
class Favorite(Base):
    __tablename__ = "favorites"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    route_id = Column(Integer, ForeignKey("bus_routes.id"))

# 예약 정보
class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    route_id = Column(Integer, ForeignKey("bus_routes.id"))
    seat_number = Column(Integer, nullable=True)
    status = Column(String, default="reserved") # main.py에서 참조함
    booked_at = Column(DateTime, default=datetime.now)
    
    user = relationship("User")
    route = relationship("BusRoute")

# 학기권 신청
class SemesterPass(Base):
    __tablename__ = "semester_passes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    route_type = Column(String)
    status = Column(String, default="pending")
    applied_at = Column(DateTime, default=datetime.now)

# 메시지/알림
class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    receiver_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    content = Column(Text)
    is_read = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
