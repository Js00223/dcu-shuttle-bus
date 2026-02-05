import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api"; 

export const Signup = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isSent, setIsSent] = useState(false);

  // 1. 인증번호 발송 함수
  const handleSendCode = async () => {
    if (!email.endsWith("@cu.ac.kr")) {
      alert("학교 메일(@cu.ac.kr)만 사용 가능합니다.");
      return;
    }
    
    try {
      const response = await api.post("/auth/send-code", null, {
        params: { email: email.trim() }
      });

      if (response.status === 200) {
        setIsSent(true);
        alert("인증번호가 발송되었습니다. 메일함을 확인해주세요!");
      }
    } catch (error: any) {
      console.error("발송 에러:", error);
      alert(`발송 실패: ${error.response?.data?.detail || "알 수 없는 에러"}`);
    }
  };

  // 2. 회원가입 제출 함수 [핵심 수정 부분]
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // 서버가 (email: str, code: str, password: str, name: str) 처럼 인자를 받을 경우,
      // 아래와 같이 params에 담아서 보내야 422 에러가 나지 않습니다.
      const response = await api.post("/api/auth/signup", null, {
        params: {
          email: email.trim(),
          code: code.trim(),
          password: password,
          name: name.trim()
        }
      });

      if (response.status === 200 || response.status === 201) {
        alert("🎉 회원가입 성공! 로그인 페이지로 이동합니다.");
        navigate("/login");
      }
    } catch (error: any) {
      // 422 에러가 나면 콘솔에 어떤 데이터가 잘못됐는지 출력됩니다.
      console.error("가입 에러 상세:", error.response?.data);
      
      const result = error.response?.data;
      let errorMsg = "정보를 다시 확인해주세요.";
      
      if (result?.detail && Array.isArray(result.detail)) {
        // 어느 필드(email 등)가 왜 틀렸는지 상세히 보여줍니다.
        errorMsg = result.detail.map((err: any) => `${err.loc[err.loc.length - 1]}: ${err.msg}`).join("\n");
      } else if (typeof result?.detail === 'string') {
        errorMsg = result.detail;
      }
      
      alert(`회원가입 실패:\n${errorMsg}`);
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
