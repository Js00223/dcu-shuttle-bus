from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Boolean
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
from database import Base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    name = Column(String)
    points = Column(Integer, default=0)

class BusRoute(Base):
    __tablename__ = "bus_routes"
    
    id = Column(Integer, primary_key=True, index=True)
    # 아래 변수명들을 seed.py와 똑같이 맞춥니다.
    route_name = Column(String)      # 전체 명칭
    location = Column(String)        # 장소
    time = Column(String, nullable=True) # 시간
    total_seats = Column(Integer, default=45)

    current_lat = Column(Float, nullable=True)  # 현재 위도
    current_lng = Column(Float, nullable=True)  # 현재 경도
    last_updated = Column(DateTime, default=datetime.now) # 마지막 위치 업데이트 시간
    is_running = Column(Integer, default=0) # 0: 운행전, 1: 운행중

class Booking(Base):
    __tablename__ = "bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    route_id = Column(Integer, ForeignKey("bus_routes.id"))
    seat_number = Column(Integer)
    booked_at = Column(DateTime, default=datetime.now)
    
    user = relationship("User")
    route = relationship("BusRoute")

class SemesterPass(Base):
    __tablename__ = "semester_passes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    route_type = Column(String) # 시외(경주, 구미, 울산, 포항)
    status = Column(String, default="pending") # pending, approved, rejected
    applied_at = Column(DateTime, default=datetime.now)

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    title = Column(String)       # 예: "포인트 충전 완료"
    content = Column(String)     # 예: "10,000P가 정상적으로 충전되었습니다."
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)