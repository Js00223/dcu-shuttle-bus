// src/utils/auth.ts
export const logout = () => {
  if (window.confirm("로그아웃 하시겠습니까?")) {
    // 로컬 데이터 삭제
    localStorage.removeItem("user");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("token");

    // 로그인 페이지로 이동
    window.location.href = "/login";
  }
};
