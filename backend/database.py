import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# --- [DB 연결 설정] ---
# 1. 사용자 이름: postgres.[프로젝트ID] (Supabase Pooler 사용 시 필수)
# 2. 비밀번호: @ 특수문자를 %40으로 인코딩
# 3. 포트: 6543 (IPv4 호환 및 세션 모드 접속용)
SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://postgres.aocsrtgjxpdsxhwtxrfd:Js00334422%40%40@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"

# --- [엔진 생성] ---
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    # 클라우드 DB 연결 안정성 옵션
    pool_pre_ping=True,      # 연결이 유효한지 체크 후 쿼리 실행 (Network is unreachable 방지)
    pool_recycle=300,        # 5분마다 연결을 재생성하여 타임아웃 방지
    pool_size=5,             # 기본 커넥션 수
    max_overflow=10          # 최대 추가 커넥션 수
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# --- [DB 세션 의존성 주입] ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
