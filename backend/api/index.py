import os
import sys

# 현재 파일의 부모 디렉토리(backend)를 파이썬 경로에 추가하여 
# database.py, models.py 등을 불러올 수 있게 합니다.
sys.path.append(os.path.dirname(os.path.abspath(os.path.dirname(__file__))))

from fastapi import FastAPI
from main import app as real_app # 기존 main.py의 FastAPI 인스턴스를 가져옴

# Vercel은 'app'이라는 변수명을 기본적으로 찾습니다.
app = real_app

# 만약 main.py에서 별도의 uvicorn.run() 코드가 있다면 
# Vercel 환경에서는 필요 없으므로 무시됩니다.