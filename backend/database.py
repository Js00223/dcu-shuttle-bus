import os
import psycopg2
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# .env 파일 로드 (환경 변수를 사용하지 않을 경우 생략 가능하지만, 관례상 포함합니다)
load_dotenv()

# --- [1. DB 연결 정보 설정] ---
# SQLAlchemy용 URL
SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://postgres.aocsrtgjxpdsxhwtxrfd:Js00334422%40%40@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"

# psycopg2 직접 연결 테스트용 변수 분리
# (URL에서 정보를 추출하거나 .env에서 가져옵니다)
DB_USER = "postgres.aocsrtgjxpdsxhwtxrfd"
DB_PASSWORD = "Js00334422@@" # 실제 연결시에는 인코딩되지 않은 원본 암호 사용
DB_HOST = "aws-0-ap-northeast-2.pooler.supabase.com"
DB_PORT = "6543"
DB_NAME = "postgres"

# --- [2. psycopg2를 이용한 즉시 연결 테스트] ---
# 서버가 시작될 때 DB가 살아있는지 가장 먼저 확인합니다.
try:
    connection = psycopg2.connect(
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME
    )
    print("✅ [psycopg2] Connection successful!")
    
    cursor = connection.cursor()
    cursor.execute("SELECT NOW();")
    result = cursor.fetchone()
    print(f"✅ [psycopg2] Current Time: {result}")

    cursor.close()
    connection.close()
    print("✅ [psycopg2] Connection check closed cleanly.")

except Exception as e:
    print(f"❌ [psycopg2] Failed to connect: {e}")

# --- [3. SQLAlchemy 엔진 생성] ---
# 실제 FastAPI 서비스가 사용할 메인 엔진입니다.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,  # 연결 유효성 체크
    pool_recycle=300,    # 5분마다 연결 재생성
    pool_size=5,
    max_overflow=10
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- [4. DB 세션 의존성 주입] ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
