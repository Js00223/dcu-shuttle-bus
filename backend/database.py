import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. DB 연결 정보 설정
# 만약 Supabase를 사용하신다면 아래 형식이 맞습니다. 
# 하지만 보안을 위해 Render 대시보드의 Environment 변수(DATABASE_URL)에 넣는 것을 권장합니다.

# 현재 코드에 적힌 Render 내부 DB 주소입니다. 
# 만약 Supabase를 쓰실 거라면 DATABASE_URL 값을 Supabase 주소로 바꾸셔야 합니다.
DEFAULT_DB_URL = "postgresql://admin:LlyYjPShOMOBMZlLKDq21MBxmAelTd8z@dpg-d6233n4oud1c7398po20-a/shuttle_bus_5w7n"

# Render의 환경변수를 먼저 읽고, 없으면 기본값(위의 주소)을 사용합니다.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

# SQLAlchemy에서 postgres://로 시작하는 주소를 처리하지 못하는 경우를 대비한 코드
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# 2. 엔진 생성
# pool_pre_ping: 연결이 유효한지 체크 (연결 끊김 방지)
# pool_recycle: 연결 유지 시간 설정
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300
)

# 3. 세션 및 베이스 클래스 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 4. DB 세션 의존성 주입 함수
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
