import os
import psycopg2
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# --- [1. DB 연결 정보 설정] ---
SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://postgres.aocsrtgjxpdsxhwtxrfd:Js00334422%40%40@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"

DB_USER = "postgres.aocsrtgjxpdsxhwtxrfd"
DB_PASSWORD = "Js00334422@@" 
DB_HOST = "aws-0-ap-northeast-2.pooler.supabase.com"
DB_PORT = "6543"
DB_NAME = "postgres"

# --- [2. psycopg2를 이용한 즉시 연결 테스트] ---
try:
    connection = psycopg2.connect(
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME
    )
    print("✅ [psycopg2] Connection successful!")
    connection.close()
except Exception as e:
    print(f"❌ [psycopg2] Failed to connect: {e}")

# --- [3. SQLAlchemy 엔진 생성] ---
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
