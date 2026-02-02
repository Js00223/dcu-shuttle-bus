import axios from "axios";

// 1. ngrok 주소 끝에 슬래시(/)가 없는지 확인하세요.
export const BACKEND_URL = "https://umbrellalike-multiseriate-cythia.ngrok-free.dev";

const api = axios.create({
  // 2. baseURL 설정 시 템플릿 리터럴 문법과 따옴표를 정확히 닫아줍니다.
  baseURL: BACKEND_URL, 
  headers: {
    "ngrok-skip-browser-warning": "69420",
    "Content-Type": "application/json",
  },
});

// 토큰 및 ngrok 우회 헤더 주입
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  
  // 3. 토큰 설정
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // 4. ngrok 우회 헤더 (모든 요청에 강제 적용)
  config.headers["ngrok-skip-browser-warning"] = "69420";

  return config;
});

export default api;
