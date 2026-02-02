import axios from "axios";

// 주소는 여기서만 딱 한 번 정의합니다.
export const BACKEND_URL =
  "https://umbrellalike-multiseriate-cythia.ngrok-free.dev";

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    "ngrok-skip-browser-warning": "69420", // 기본 헤더 설정
    "Content-Type": "application/json",
  },
});

// 토큰 및 ngrok 우회 헤더를 모든 요청에 강제로 주입하는 설정
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  
  // 1. 토큰이 있으면 Authorization 헤더 추가
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // 2. ngrok 우회 헤더를 인터셉터에서도 한 번 더 확인 (Vercel 배포 환경 대응)
  config.headers["ngrok-skip-browser-warning"] = "69420";

  return config;
});

export default api;
