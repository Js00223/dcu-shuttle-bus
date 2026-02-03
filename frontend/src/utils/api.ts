// src/api.ts (또는 api.ts 위치)
import axios from "axios";

// ❌ 기존 ngrok 주소 (에러의 원인)
// export const BACKEND_URL = "https://umbrellalike-multiseriate-cythia.ngrok-free.dev";

// ✅ 새로운 Render 주소 (CORS 문제 해결 및 24시간 가동)
export const BACKEND_URL = "https://dcu-shuttle-bus.onrender.com/api"; 

const api = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// 인터셉터 설정 (기존과 동일)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Render로 옮기면 ngrok-skip-browser-warning 헤더는 더 이상 필수가 아니지만, 
  // 두어도 상관없습니다.
  return config;
});

export default api;
