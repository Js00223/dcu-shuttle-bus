import axios from "axios";

// 1. 주소 마지막에 슬래시(/)가 절대 없어야 합니다.
export const BACKEND_URL = "https://dcu-shuttle-bus.onrender.com";

const api = axios.create({
  // 2. `${BACKEND_URL}` 형태 대신 변수를 직접 넣는 것이 오타 방지에 좋습니다.
  baseURL: BACKEND_URL, 
  headers: {
    "Content-Type": "application/json",
  },
});

// 모든 요청에 ngrok 우회 헤더와 토큰을 넣는 인터셉터
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  
  // ngrok 경고 페이지 우회 헤더 (필수)
  config.headers["ngrok-skip-browser-warning"] = "69420";
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
