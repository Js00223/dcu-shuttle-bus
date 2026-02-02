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
      // 1. 주소 중복 오류 수정 및 환경 변수 적용
      const url = `${API_BASE_URL}/api/auth/send-code?email=${email}`;
      
      const response = await fetch(url, { 
        method: "POST",
        headers: {
          // 2. ngrok 경고 페이지 스킵 헤더 추가
          "ngrok-skip-browser-warning": "69420",
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        setIsSent(true);
        alert("인증번호가 발송되었습니다.");
      } else {
        alert("인증번호 발송에 실패했습니다.");
      }
    } catch (error) {
      console.error("발송 에러:", error);
      alert("서버와 연결할 수 없습니다.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // 3. 회원가입 주소도 환경 변수로 수정
      const url = `${API_BASE_URL}/api/auth/signup?email=${email}&password=${password}&name=${name}&code=${code}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "ngrok-skip-browser-warning": "69420",
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        alert("회원가입 완료! 로그인 페이지로 이동합니다.");
        navigate("/login");
      } else {
        const data = await response.json();
        alert(data.detail || "회원가입에 실패했습니다.");
      }
    } catch (error) {
      console.error("가입 에러:", error);
      alert("서버와 연결할 수 없습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-xl">
        <h2 className="text-3xl font-black mb-6">회원가입</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="이름"
            className="w-full p-4 bg-gray-100 rounded-2xl outline-none"
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="학교 이메일 (@cu.ac.kr)"
              className="flex-1 p-4 bg-gray-100 rounded-2xl outline-none"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={handleSendCode}
              className="bg-blue-600 text-white px-4 rounded-2xl font-bold text-sm"
            >
              인증
            </button>
          </div>
          {isSent && (
            <input
              type="text"
              placeholder="인증번호 6자리"
              className="w-full p-4 bg-gray-100 rounded-2xl outline-none border-2 border-blue-200"
              onChange={(e) => setCode(e.target.value)}
              required
            />
          )}
          <input
            type="password"
            placeholder="비밀번호"
            className="w-full p-4 bg-gray-100 rounded-2xl outline-none"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black text-lg mt-4"
          >
            가입하기
          </button>
        </form>
      </div>
    </div>
  );
};
