import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. 연결 정보 (사용자 이름 형식이 가장 중요합니다!)
DB_USER = "postgres.aocsrtgjxpdsxhwtxrfd" 
DB_PASS = "Js00334422%40%40" 
DB_HOST = "aws-0-ap-northeast-2.pooler.supabase.com"
DB_PORT = "6543"
DB_NAME = "postgres"

# 최종 연결 URL (옵션 없이 깨끗하게 구성)
SQLALCHEMY_DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# 2. 엔진 생성
# invalid connection option 에러를 피하기 위해 connect_args를 비웁니다.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,  # 연결 유효성 체크 (필수)
    pool_recycle=300     # 5분마다 연결 갱신
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# DB 세션 의존성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
