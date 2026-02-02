import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# --- [DB 연결 설정] ---
# 1. postgresql+psycopg2 프로토콜 사용
# 2. 비밀번호 특수문자 @를 %40으로 인코딩 완료
SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://postgres:Js00334422%40%40@db.aocsrtgjxpdsxhwtxrfd.supabase.co:5432/postgres"

# --- [엔진 생성] ---
# PostgreSQL 환경에서는 connect_args={"check_same_thread": False} 옵션이 있으면 에러가 발생하므로 제거했습니다.
engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# --- [DB 세션 의존성 주입] ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
