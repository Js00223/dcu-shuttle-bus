import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api"; // 1. 우리가 만든 api 설정을 가져옵니다. (경로 확인 필요)

export const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 2. api 인스턴스를 사용해 깔끔하게 호출합니다.
      // 주소를 길게 적을 필요 없이 baseURL 뒤의 경로만 적으면 됩니다.
      const response = await api.post("/api/auth/login", {
        email: email,
        password: password,
      });

      // axios는 응답이 성공(200번대)하면 바로 여기로 옵니다.
      const userData = response.data;

      // 3. 데이터 저장 (토큰 및 유저 정보)
      const tokenValue = userData.token || userData.access_token || "login_success_token";
      localStorage.setItem("token", tokenValue);
      localStorage.setItem("user", JSON.stringify(userData));

      if (userData.points !== undefined) {
        localStorage.setItem("points", userData.points.toString());
      }

      alert(`${userData.name || "사용자"}님, 환영합니다!`);

      // 4. 페이지 이동 및 갱신
      navigate("/");
      window.location.reload();

    } catch (err: any) {
      console.error("로그인 에러:", err);
      
      // 서버에서 보낸 에러 메시지가 있다면 보여주고, 없으면 기본 메시지 출력
      const errorMessage = err.response?.data?.detail || "로그인 정보가 올바르지 않거나 서버 오류가 발생했습니다.";
      alert(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md p-10 rounded-[2.5rem] shadow-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-gray-900 mb-2">
            DCU Shuttle
          </h1>
          <p className="text-gray-400 font-medium">
            서비스 이용을 위해 로그인해주세요
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="학교 이메일 (@cu.ac.kr)"
            className="w-full p-4 bg-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="비밀번호"
            className="w-full p-4 bg-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black text-lg shadow-lg shadow-blue-200 active:scale-95 transition-transform mt-4"
          >
            로그인
          </button>
        </form>

        <div className="mt-8 flex justify-center gap-6 text-sm font-bold text-gray-400">
          <Link to="/signup" className="hover:text-blue-600 transition-colors">
            회원가입
          </Link>
          <span className="text-gray-200">|</span>
          <Link
            to="/forgot-password"
            className="hover:text-blue-600 transition-colors"
          >
            비밀번호 찾기
          </Link>
        </div>
      </div>
    </div>
  );
};
