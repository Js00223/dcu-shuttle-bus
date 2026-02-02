import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 프로젝트 ID: aocsrtgjxpdsxhwtxrfd
# 정확한 조합: postgres.aocsrtgjxpdsxhwtxrfd
DB_USER = "postgres.aocsrtgjxpdsxhwtxrfd"
DB_PASS = "Js00334422%40%40" # @ 기호를 %40으로 인코딩
DB_HOST = "aws-0-ap-northeast-2.pooler.supabase.com"
DB_PORT = "6543"
DB_NAME = "postgres"

# f-string을 사용하여 오타 없이 조합
SQLALCHEMY_DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

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
