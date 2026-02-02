import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. 현재 파일(database.py)의 디렉토리 경로를 가져옵니다.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 2. DB 파일 이름을 설정합니다. (사진에 있던 shuttle.db)
DB_NAME = "shuttle.db"

# 3. Vercel 환경과 로컬 환경 모두에서 작동하도록 절대 경로를 생성합니다.
# backend 폴더 바로 아래에 shuttle.db가 있는 경우:
DB_PATH = os.path.join(BASE_DIR, DB_NAME)

# database.py

# 1. postgresql (l 필수) 
# 2. +psycopg2 (드라이버 명시)
# 3. %40%40 (특수문자 인코딩)
SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://postgres:Js00334422%40%40@db.aocsrtgjxpdsxhwtxrfd.supabase.co:5432/postgres"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}  # SQLite를 FastAPI에서 사용할 때 필수
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
