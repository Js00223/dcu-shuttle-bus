import { useState } from "react";
import { useNavigate } from "react-router-dom";

export const Signup = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isSent, setIsSent] = useState(false);

  const handleSendCode = async () => {
    if (!email.endsWith("@cu.ac.kr")) {
      alert("학교 메일(@cu.ac.kr)만 사용 가능합니다.");
      return;
    }
    const response = await fetch(
      `https://umbrellalike-multiseriate-cythia.ngrok-free.dev/apimultiseriate-cythia.ngrok-free.dev/api/auth/send-code?email=${email}`,
      { method: "POST" },
    );
    if (response.ok) {
      setIsSent(true);
      alert("인증번호가 발송되었습니다.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch(
      `https://umbrellalike-multiseriate-cythia.ngrok-free.dev/apimultiseriate-cythia.ngrok-free.dev/api/auth/signup?email=${email}&password=${password}&name=${name}&code=${code}`,
      {
        method: "POST",
      },
    );

    if (response.ok) {
      alert("회원가입 완료! 로그인 페이지로 이동합니다.");
      navigate("/login"); // navigate 사용으로 에러 해결
    } else {
      const data = await response.json();
      alert(data.detail);
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
              onChange={(e) => setCode(e.target.value)} // code 사용으로 에러 해결
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
