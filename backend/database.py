import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. 정보를 정확하게 입력하세요.
# 프로젝트 ID: aocsrtgjxpdsxhwtxrfd
# 사용자 이름: postgres.aocsrtgjxpdsxhwtxrfd (이 형식이 아니면 FATAL 에러가 납니다)
# 비밀번호: Js00334422%40%40 (@는 %40으로 인코딩됨)

DB_USER = "postgres.aocsrtgjxpdsxhwtxrfd"
DB_PASS = "Js00334422%40%40"
DB_HOST = "aws-0-ap-northeast-2.pooler.supabase.com"
DB_PORT = "6543"
DB_NAME = "postgres"

# 최종 URL 조합
SQLALCHEMY_DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# 2. 엔진 설정 (Pooler 사용 시 아래 옵션들이 안정성을 높여줍니다)
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,  # 연결이 유효한지 미리 체크
    pool_recycle=300,    # 5분마다 연결 갱신
    connect_args={
        "prepare_threshold": 0  # Supabase Pooler(PgBouncer) 환경에서 필수 설정
    }
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
