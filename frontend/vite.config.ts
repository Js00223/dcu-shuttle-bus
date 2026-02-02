// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "https://umbrellalike-multiseriate-cythia.ngrok-free.dev",
        changeOrigin: true,
        // rewrite를 주석 처리하거나 삭제하세요.
        // 이제 백엔드가 /api 주소를 직접 인식합니다.
      },
    },
  },
});
