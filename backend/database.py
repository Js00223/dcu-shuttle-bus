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

# 4. SQLAlchemy용 데이터베이스 URL 설정
# SQLite는 상대 경로보다 'sqlite:////경로' 식의 절대 경로가 안전합니다.
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

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