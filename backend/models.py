from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base  # ✅ 중요: 여기서 가져온 Base만 사용해야 합니다.
from sqlalchemy.sql import func

# ❌ Base = declarative_base()  <-- 이 줄이 있다면 반드시 삭제하세요!

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    name = Column(String)
    phone = Column(String, nullable=True)
    points = Column(Integer, default=0)

class BusRoute(Base):
    __tablename__ = "bus_routes"
    id = Column(Integer, primary_key=True, index=True)
    route_name = Column(String)
    location = Column(String)
    time = Column(String, nullable=True) 
    total_seats = Column(Integer, default=45)
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    last_updated = Column(DateTime, default=datetime.now)
    is_running = Column(Integer, default=0)

class Favorite(Base):
    __tablename__ = "favorites"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    route_id = Column(Integer, ForeignKey("bus_routes.id"))

class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    route_id = Column(Integer, ForeignKey("bus_routes.id"))
    status = Column(String, default="reserved")
    seat_number = Column(Integer, nullable=True)
    booked_at = Column(DateTime, default=datetime.now)
    
    user = relationship("User")
    route = relationship("BusRoute")

class SemesterPass(Base):
    __tablename__ = "semester_passes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    route_type = Column(String)
    status = Column(String, default="pending")
    applied_at = Column(DateTime, default=datetime.now)

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    receiver_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    content = Column(Text)
    is_read = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
