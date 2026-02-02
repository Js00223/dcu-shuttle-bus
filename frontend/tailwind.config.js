/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // 앱의 메인 컬러를 미리 지정해두면 관리가 편해요!
        brand: {
          primary: "#3B82F6",
          secondary: "#1E293B",
          accent: "#F59E0B",
        },
      },
      // 모바일(iOS/Android)의 노치 디자인이나 상태표시줄 대응용
      spacing: {
        "safe-top": "var(--safe-area-inset-top)",
        "safe-bottom": "var(--safe-area-inset-bottom)",
        "safe-left": "var(--safe-area-inset-left)",
        "safe-right": "var(--safe-area-inset-right)",
      },
    },
  },
  plugins: [],
};
