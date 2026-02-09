import { useState, useEffect, useCallback, useRef } from "react";
import { logout } from "../utils/auth";
import api from "../utils/api"; 
import { useNavigate } from "react-router-dom";

export const MyPage = () => {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState<string>("");
  const [points, setPoints] = useState<number>(0);
  const [phone, setPhone] = useState<string>("");

  const [isEditing, setIsEditing] = useState(false);
  const [tempPhone, setTempPhone] = useState("");
  const [loading, setLoading] = useState(true);

  // 인증 관련 상태값
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);

  const isFetching = useRef(false);

  // [기능 1] 서버로부터 유저 정보 및 즐겨찾기 목록 가져오기
  const fetchUserData = useCallback(async () => {
    if (isFetching.current) return;
    
    try {
      isFetching.current = true;
      setLoading(true);

      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      if (!userId) {
        console.error("유저 ID가 없습니다.");
        return;
      }

      const response = await api.get("/user/status", {
        params: { user_id: userId }
      });

      if (response.data) {
        const data = response.data;
        const dynamicStudentId = 
          data.studentId || 
          data.email?.split("@")[0] || 
          "정보 없음";

        setStudentId(dynamicStudentId);
        setPoints(data.points ?? 0);
        setPhone(data.phone || "연락처 미등록");
        setTempPhone(data.phone || "");
        setEmail(data.email || ""); 

        if (data.favorites) {
          localStorage.setItem("bus-favorites", JSON.stringify(data.favorites));
        }

        localStorage.setItem("user", JSON.stringify({ 
          ...user, 
          ...data, 
          studentId: dynamicStudentId 
        }));
      }
    } catch (error: any) {
      if (error.code !== 'ERR_CANCELED') {
        console.error("마이페이지 동기화 실패:", error);
      }
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // [🌟 유효성 검사 강화] 전화번호 유효성 검사 함수
  const validatePhoneNumber = (num: string) => {
    // 010-XXXX-XXXX 형식 검사 (중간 번호는 2~9로 시작)
    const regex = /^010-([2-9]\d{3})-(\d{4})$/;
    if (!regex.test(num)) return { valid: false, msg: "010-0000-0000 형식으로 입력해주세요." };

    const parts = num.split("-");
    const mid = parts[1];
    const last = parts[2];

    // 1. 동일 숫자 반복 (예: 1111, 2222)
    const isRepeated = (str: string) => /^(\d)\1{3}$/.test(str);
    if (isRepeated(mid) || isRepeated(last)) {
      return { valid: false, msg: "동일한 숫자가 반복되는 번호는 사용할 수 없습니다." };
    }

    // 2. 연속 숫자 (예: 1234, 4321, 5678)
    const sequential = "01234567890 98765432109";
    if (sequential.includes(mid) || sequential.includes(last)) {
      return { valid: false, msg: "연속된 숫자가 포함된 번호는 사용할 수 없습니다." };
    }

    // 3. 비정상 패턴 (예: 010-1234-1234)
    if (mid === last) {
      return { valid: false, msg: "비정상적인 번호 패턴입니다." };
    }

    return { valid: true, msg: "" };
  };

  // [🌟 인증번호 발송]
  const handleSendCode = async () => {
    try {
      await api.post("/auth/send-code", null, { params: { email } });
      setIsCodeSent(true);
      alert("이메일로 인증번호가 전송되었습니다.");
    } catch (error) {
      alert("인증번호 전송 실패");
    }
  };

  // [기능 2] 연락처 수정 (본인 인증 포함)
  const handleSavePhone = async () => {
    const validation = validatePhoneNumber(tempPhone);
    if (!validation.valid) {
      alert(validation.msg);
      return;
    }

    if (!verificationCode) {
      alert("이메일 인증번호를 입력해주세요.");
      return;
    }

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      await api.post("/user/update-phone", { 
        user_id: Number(userId),
        phone: tempPhone,
        code: verificationCode 
      });

      setPhone(tempPhone);
      localStorage.setItem("user", JSON.stringify({ ...user, phone: tempPhone }));
      setIsEditing(false);
      setIsCodeSent(false);
      setVerificationCode("");
      alert("연락처가 서버에 저장되었습니다.");
    } catch (error: any) {
      alert(error.response?.data?.detail || "변경 실패: 인증번호를 확인하세요.");
    }
  };

  // [기능 3] 회원 탈퇴
  const handleDeleteAccount = async () => {
    if (!window.confirm("정말로 탈퇴하시겠습니까?")) return;
    const password = window.prompt("비밀번호를 입력해주세요.");
    if (!password) return;

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await api.post("/auth/delete-account", {
        user_id: user.user_id || user.id,
        password: password
      });

      if (response.data.status === "success") {
        alert("탈퇴 완료");
        localStorage.clear();
        navigate("/"); 
      }
    } catch (error: any) {
      alert("탈퇴 실패: 비밀번호를 확인하세요.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center">
        <p className="text-gray-400 font-bold animate-pulse">정보 동기화 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col p-6 font-pretendard">
      <div className="pt-12 mb-8 text-center">
        <h1 className="text-3xl font-black text-gray-900">마이페이지</h1>
      </div>

      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 mb-6">
        <div className="w-20 h-20 bg-[#E8E8ED] rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">👤</div>
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-[#8E8E93] text-[10px] font-bold uppercase tracking-widest mb-1">Student ID</p>
            <h2 className="text-xl font-black text-gray-900">{studentId}</h2>
          </div>
          <hr className="border-gray-50" />
          <div className="flex justify-between items-center px-4">
            <span className="text-gray-500 font-bold">남은 포인트</span>
            <span className="text-blue-600 font-black text-lg">{(points ?? 0).toLocaleString()} P</span>
          </div>
          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-[#8E8E93] text-[10px] font-bold uppercase tracking-widest mb-2">Contact</p>
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={tempPhone} 
                    onChange={(e) => setTempPhone(e.target.value)} 
                    placeholder="010-0000-0000"
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" 
                  />
                  {!isCodeSent ? (
                    <button onClick={handleSendCode} className="bg-gray-800 text-white px-3 py-2 rounded-lg text-[10px] font-bold whitespace-nowrap">인증요청</button>
                  ) : (
                    <button onClick={handleSendCode} className="bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-[10px] font-bold whitespace-nowrap">재전송</button>
                  )}
                </div>
                {isCodeSent && (
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={verificationCode} 
                      onChange={(e) => setVerificationCode(e.target.value)} 
                      placeholder="인증번호 6자리"
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" 
                    />
                    <button onClick={handleSavePhone} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap">변경확인</button>
                  </div>
                )}
                <button onClick={() => { setIsEditing(false); setIsCodeSent(false); setVerificationCode(""); }} className="text-gray-400 text-[10px] block w-full text-center">취소</button>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-gray-800 font-bold">{phone}</span>
                <button onClick={() => setIsEditing(true)} className="text-blue-600 text-xs font-bold underline">수정하기</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-3 pb-8">
        <button onClick={logout} className="w-full py-5 bg-white text-gray-400 rounded-[1.5rem] font-bold border border-gray-200">로그아웃</button>
        <button onClick={handleDeleteAccount} className="w-full py-4 text-red-400 rounded-[1.5rem] font-medium text-sm opacity-60">회원 탈퇴하기</button>
      </div>
    </div>
  );
};
