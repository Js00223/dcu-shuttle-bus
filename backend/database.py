import os
import psycopg2
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# --- [설정값 정의] ---
# 프로젝트 ID: aocsrtgjxpdsxhwtxrfd
# 사용자 이름은 반드시 'postgres.프로젝트ID' 형식이어야 합니다.
DB_USER = "postgres.aocsrtgjxpdsxhwtxrfd"
DB_PASS_RAW = "Js00334422@@"          # psycopg2용 원본 비밀번호
DB_PASS_ENC = "Js00334422%40%40"      # SQLAlchemy URL용 인코딩된 비밀번호
DB_HOST = "db.aocsrtgjxpdsxhwtxrfd.supabase.co"
DB_PORT = "6543"
DB_NAME = "postgres"

# 1. SQLAlchemy용 URL 구성
SQLALCHEMY_DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASS_ENC}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# --- [psycopg2 직접 연결 테스트] ---
try:
    # pooler 사용 시 user 이름에 .project_id가 붙어있는지 재확인
    connection = psycopg2.connect(
        user=DB_USER,
        password=DB_PASS_RAW,
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME
    )
    print("✅ [psycopg2] Connection successful!")
    connection.close()
except Exception as e:
    # 여기서 에러가 난다면 Supabase 대시보드의 'User' 항목을 다시 확인해야 합니다.
    print(f"❌ [psycopg2] Connection failed: {e}")

# --- [SQLAlchemy 엔진 생성] ---
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
