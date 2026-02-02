import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `https://umbrellalike-multiseriate-cythia.ngrok-free.dev/apimultiseriate-cyteia.ngrlk-free.dev/apimultiseriate-cythia.ngrok-free.dev/api/auth/login?email=${email}&password=${password}`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        const userData = await response.json();

        // [수정 핵심] 서버에서 온 데이터(토큰 등)를 'token'이라는 이름으로 저장합니다.
        // 만약 서버가 userData.access_token 형태로 준다면 아래처럼 수정하세요.
        // const token = userData.access_token || userData.token || "temp-token";

        // 현재는 서버 응답 전체를 활용해 token과 user 정보를 모두 저장해 동기화를 맞춥니다.
        const tokenValue =
          userData.token || userData.access_token || "login_success_token";

        localStorage.setItem("token", tokenValue); // Favorites, PointAndPass에서 사용
        localStorage.setItem("user", JSON.stringify(userData)); // App.tsx 및 UI용

        // 추가로 마이페이지 동기화를 위해 필요한 정보가 있다면 미리 저장
        if (userData.points !== undefined)
          localStorage.setItem("points", userData.points);

        alert(`${userData.name || "사용자"}님, 환영합니다!`);

        // 로그인 성공 후 홈으로 이동 (이제 App.tsx의 PrivateRoute를 통과하게 됩니다)
        navigate("/");
        window.location.reload(); // 하단바 상태를 즉시 갱신하기 위해 새로고침 권장
      } else {
        const errorData = await response.json();
        alert(errorData.detail || "로그인에 실패했습니다.");
      }
    } catch (err) {
      console.error("로그인 네트워크 오류:", err);
      alert(
        "서버와 연결할 수 없습니다. 백엔드 서버가 켜져 있는지 확인해 주세요.",
      );
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
