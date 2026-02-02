import { useState } from "react";
import { useNavigate } from "react-router-dom";

export const Signup = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isSent, setIsSent] = useState(false);

  // 환경 변수에서 베이스 URL 가져오기
  const API_BASE_URL = import.meta.env.VITE_API_URL || "";

  const handleSendCode = async () => {
    if (!email.endsWith("@cu.ac.kr")) {
      alert("학교 메일(@cu.ac.kr)만 사용 가능합니다.");
      return;
    }
    
    try {
      const url = `${API_BASE_URL}/api/auth/send-code?email=${email}`;
      
      const response = await fetch(url, { 
        method: "POST",
        headers: {
          "ngrok-skip-browser-warning": "69420",
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        setIsSent(true);
        alert("인증번호가 발송되었습니다. 메일함을 확인해주세요!");
      } else {
        const errorData = await response.json();
        console.error("인증번호 발송 실패 상세:", errorData);
        alert(`발송 실패: ${errorData.detail || "알 수 없는 에러"}`);
      }
    } catch (error) {
      console.error("네트워크 에러 (발송):", error);
      alert("서버와 연결할 수 없습니다. 백엔드와 ngrok이 켜져 있는지 확인하세요.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // 쿼리 스트링 방식 유지 (백엔드 설계에 맞춤)
      const url = `${API_BASE_URL}/api/auth/signup?email=${email}&password=${password}&name=${name}&code=${code}`;
      
      console.log("회원가입 요청 시도 중...");
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "ngrok-skip-browser-warning": "69420",
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        alert("🎉 회원가입 성공! 로그인 페이지로 이동합니다.");
        navigate("/login");
      } else {
        // 400 Bad Request 등의 에러 메시지를 백엔드로부터 받아 출력
        const data = await response.json();
        console.warn("회원가입 거절 사유:", data.detail); 
        alert(`회원가입 실패: ${data.detail}`); // 여기서 '인증번호 불일치' 등이 표시됨
      }
    } catch (error) {
      console.error("네트워크 에러 (가입):", error);
      alert("서버 통신에 실패했습니다. 다시 시도해주세요.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-xl">
        <h2 className="text-3xl font-black mb-6 text-gray-900">회원가입</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="이름"
            className="w-full p-4 bg-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="학교 이메일 (@cu.ac.kr)"
              className="flex-1 p-4 bg-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={handleSendCode}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-2xl font-bold text-sm transition-colors"
            >
              인증
            </button>
          </div>
          {isSent && (
            <input
              type="text"
              placeholder="인증번호 6자리 입력"
              className="w-full p-4 bg-gray-100 rounded-2xl outline-none border-2 border-blue-400 focus:ring-2 focus:ring-blue-500 animate-fade-in"
              onChange={(e) => setCode(e.target.value)}
              required
            />
          )}
          <input
            type="password"
            placeholder="비밀번호"
            className="w-full p-4 bg-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl font-black text-lg mt-4 shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            가입하기
          </button>
        </form>
      </div>
    </div>
  );
};
