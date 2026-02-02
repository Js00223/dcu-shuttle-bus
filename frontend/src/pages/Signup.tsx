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

  // 1. 인증번호 발송 (기존 방식 유지 - 이메일만 파라미터로 전달)
  const handleSendCode = async () => {
    if (!email.endsWith("@cu.ac.kr")) {
      alert("학교 메일(@cu.ac.kr)만 사용 가능합니다.");
      return;
    }
    
    try {
      const params = new URLSearchParams({ email });
      const url = `${API_BASE_URL}/api/auth/send-code?${params.toString()}`;
      
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
        alert(`발송 실패: ${errorData.detail || "알 수 없는 에러"}`);
      }
    } catch (error) {
      console.error("네트워크 에러 (발송):", error);
      alert("서버와 연결할 수 없습니다.");
    }
  };

  // 2. 회원가입 제출 (중요: Body에 JSON 담아 보내기)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // URL은 더 이상 파라미터를 붙이지 않고 깔끔하게 유지합니다.
      const url = `${API_BASE_URL}/api/auth/signup`;
      
      console.log("회원가입 요청 시도 (Body 전송 방식)");
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "ngrok-skip-browser-warning": "69420",
          "Content-Type": "application/json", // JSON 형식을 서버에 알림
        },
        // 데이터를 JSON 문자열로 변환하여 Body에 담습니다.
        body: JSON.stringify({
          email: string(email),
          code: string(code),
          password: string(password),
          name: string(name)
        }),
      });

      if (response.ok) {
        alert("🎉 회원가입 성공! 로그인 페이지로 이동합니다.");
        navigate("/login");
      } else {
        const data = await response.json();
        console.warn("회원가입 거절 사유:", data.detail); 
        alert(`회원가입 실패: ${data.detail || "정보를 확인해주세요."}`);
      }
    } catch (error) {
      console.error("가입 에러:", error);
      alert("서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.");
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
