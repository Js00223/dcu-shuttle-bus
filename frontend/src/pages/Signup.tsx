import { useState } from "react";
import { useNavigate } from "react-router-dom";

export const Signup = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isSent, setIsSent] = useState(false);

  // 환경 변수 확인
  const API_BASE_URL = import.meta.env.VITE_API_URL || "";

  // 1. 인증번호 발송
  const handleSendCode = async () => {
    if (!email.endsWith("@cu.ac.kr")) {
      alert("학교 메일(@cu.ac.kr)만 사용 가능합니다.");
      return;
    }
    
    try {
      const url = `${API_BASE_URL}/api/auth/send-code?email=${encodeURIComponent(email)}`;
      
      const response = await fetch(url, { 
        method: "POST",
        headers: {
          "ngrok-skip-browser-warning": "69420",
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

  // 2. 회원가입 제출 (Body 전송 방식 최적화)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 전송할 데이터 객체 (String 대문자 수정 및 검증)
    const signupData = {
      email: String(email).trim(),
      code: String(code).trim(),
      password: String(password),
      name: String(name).trim()
    };

    // [디버깅] 전송 직전 콘솔 확인 (값이 비어있는지 꼭 보세요!)
    console.log("📤 서버로 전송할 데이터:", signupData);
    
    try {
      const url = `${API_BASE_URL}/api/auth/signup`;
      
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json", // 이 헤더가 필수입니다!
    "ngrok-skip-browser-warning": "69420",
  },
  body: JSON.stringify({
    email: email.trim(),
    code: code.trim(),
    password: password,
    name: name.trim()
  }),
});

      const result = await response.json();

      if (response.ok) {
        alert("🎉 회원가입 성공! 로그인 페이지로 이동합니다.");
        navigate("/login");
      } else {
        // 422 에러 시 상세 이유를 콘솔에 출력
        console.error("❌ 서버 응답 에러 상세:", result);
        
        // 에러 메시지 가독성 처리
        let errorMsg = "정보를 다시 확인해주세요.";
        if (result.detail && Array.isArray(result.detail)) {
          errorMsg = result.detail.map((err: any) => `${err.loc[1]}: ${err.msg}`).join("\n");
        } else if (typeof result.detail === 'string') {
          errorMsg = result.detail;
        }
        
        alert(`회원가입 실패:\n${errorMsg}`);
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="학교 이메일 (@cu.ac.kr)"
              className="flex-1 p-4 bg-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={email}
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
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          )}
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl font-black text-lg mt-4 shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            가입하기
          </button>
        </form>
      </div>
    </div>
  );
};
