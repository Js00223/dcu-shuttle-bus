import axios from "axios";

// 주소는 여기서만 딱 한 번 정의합니다.
export const BACKEND_URL =
  "https://umbrellalike-multiseriate-cythia.ngrok-free.dev";

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    "ngrok-skip-browser-warning": "69420",
    "Content-Type": "application/json",
  },
});

// 토큰이 있으면 자동으로 넣어주는 설정
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
