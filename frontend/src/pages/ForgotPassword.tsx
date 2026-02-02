import { useState } from "react";
import { useNavigate } from "react-router-dom";

export const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSent, setIsSent] = useState(false);

  const handleSendCode = async () => {
    if (!email.endsWith("@cu.ac.kr")) {
      alert("학교 메일(@cu.ac.kr)을 입력해주세요.");
      return;
    }
    const res = await fetch(
      `https://umbrellalike-multiseriate-cythia.ngrok-free.dev/apimultiseriate-cythia.ngrok-free.dev/api/auth/send-code?email=${email}`,
      { method: "POST" },
    );
    if (res.ok) {
      setIsSent(true);
      alert("인증번호가 발송되었습니다. 터미널을 확인하세요.");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(
      `https://umbrellalike-multiseriate-cythia.ngrok-free.dev/apimultiseriate-cythia.ngrok-free.dev/api/auth/reset-password?email=${email}&code=${code}&new_password=${newPassword}`,
      {
        method: "POST",
      },
    );

    if (res.ok) {
      alert("비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.");
      navigate("/login");
    } else {
      const err = await res.json();
      alert(err.detail);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md p-10 rounded-[2.5rem] shadow-sm">
        <h2 className="text-2xl font-black mb-2">비밀번호 찾기</h2>
        <p className="text-gray-400 text-sm mb-8 font-medium">
          학교 메일 인증을 통해 비밀번호를 재설정합니다.
        </p>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="학번@cu.ac.kr"
              className="flex-1 p-4 bg-gray-100 rounded-2xl outline-none"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={handleSendCode}
              className="bg-gray-900 text-white px-5 rounded-2xl font-bold text-xs"
            >
              인증
            </button>
          </div>

          {isSent && (
            <>
              <input
                type="text"
                placeholder="인증번호 6자리"
                className="w-full p-4 bg-gray-100 rounded-2xl outline-none border-2 border-blue-100 animate-in fade-in"
                onChange={(e) => setCode(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="새로운 비밀번호 입력"
                className="w-full p-4 bg-gray-100 rounded-2xl outline-none animate-in fade-in"
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button
                type="submit"
                className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black text-lg mt-4 shadow-lg shadow-blue-100"
              >
                비밀번호 변경하기
              </button>
            </>
          )}
        </form>

        <button
          onClick={() => navigate("/login")}
          className="w-full mt-6 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
        >
          로그인 화면으로 돌아가기
        </button>
      </div>
    </div>
  );
};
