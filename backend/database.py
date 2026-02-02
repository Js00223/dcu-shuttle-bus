from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. DB 주소 설정 (반드시 .pooler.supabase.com 형식을 사용하세요)
# 유저: postgres.aocsrtgjxpdsxhwtxrfd
# 암호: Js00334422@@ (URL 인코딩 처리됨)
SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://postgres.aocsrtgjxpdsxhwtxrfd:Js00334422%40%40@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"

# 2. SQLAlchemy 엔진 생성
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,  # 연결 끊김 방지
    pool_recycle=300     # 5분마다 연결 재설정
)

# 3. 세션 및 베이스 클래스 설정
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 4. DB 의존성 함수
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
