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

  // 🌟 추가된 상태값: 인증 관련
  const [email, setEmail] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
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
        setEmail(data.email || ""); // 인증을 위한 이메일 저장

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

  // 🌟 [추가 로직] 전화번호 유효성 검사 함수
  const validatePhoneNumber = (num: string) => {
    // 010-XXXX-XXXX 형식 검사 (실제 사용 가능한 국번 범위 등 고려)
    const regex = /^010-([2-9]\d{3})-(\d{4})$/;
    
    if (!regex.test(num)) return { valid: false, msg: "010-0000-0000 형식으로 입력해주세요." };
    
    // 동일 숫자 반복 (예: 010-1111-1111) 또는 연속 숫자 (예: 010-1234-5678) 체크
    const parts = num.split("-");
    const mid = parts[1];
    const last = parts[2];
    
    const isRepeated = (str: string) => /^(\d)\1{3}$/.test(str);
    const isSequential = (str: string) => "01234567890123456789".includes(str) || "98765432109876543210".includes(str);

    if (isRepeated(mid) || isRepeated(last)) return { valid: false, msg: "유효하지 않은 번호 패턴입니다." };
    if (isSequential(mid) || isSequential(last)) return { valid: false, msg: "연속된 숫자는 사용할 수 없습니다." };

    return { valid: true, msg: "" };
  };

  // 🌟 [추가 로직] 인증번호 발송
  const handleSendCode = async () => {
    try {
      await api.post("/auth/send-code", null, { params: { email } });
      setIsCodeSent(true);
      alert("이메일로 인증번호가 전송되었습니다.");
    } catch (error) {
      alert("인증번호 전송 실패");
    }
  };

  // [기능 2] 연락처 수정 (인증 단계 포함)
  const handleSavePhone = async () => {
    // 1. 유효성 검사
    const validation = validatePhoneNumber(tempPhone);
    if (!validation.valid) {
      alert(validation.msg);
      return;
    }

    // 2. 인증 여부 확인 (이 단계는 백엔드에서도 검증해야 안전하지만, 프론트에서도 막아줍니다)
    if (!verificationCode) {
      alert("이메일 인증번호를 입력해주세요.");
      return;
    }

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      // 백엔드 API에서 인증번호와 함께 업데이트 요청 (인증번호 검증 로직이 API에 포함되어야 함)
      await api.post("/user/update-phone", { 
        user_id: userId,
        phone: tempPhone,
        code: verificationCode // 서버에서 검증하도록 전달
      });

      setPhone(tempPhone);
      localStorage.setItem("user", JSON.stringify({ ...user, phone: tempPhone }));
      setIsEditing(false);
      setIsVerifying(false);
      setIsCodeSent(false);
      setVerificationCode("");
      alert("연락처가 성공적으로 변경되었습니다.");
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
                    placeholder="010-0000-0000"
                    value={tempPhone} 
                    onChange={(e) => setTempPhone(e.target.value)} 
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" 
                  />
                  {!isCodeSent ? (
                    <button onClick={handleSendCode} className="bg-gray-800 text-white px-3 py-2 rounded-lg text-[10px] font-bold">인증요청</button>
                  ) : (
                    <button onClick={handleSendCode} className="bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-[10px] font-bold">재전송</button>
                  )}
                </div>
                
                {isCodeSent && (
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="인증번호 6자리"
                      value={verificationCode} 
                      onChange={(e) => setVerificationCode(e.target.value)} 
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" 
                    />
                    <button onClick={handleSavePhone} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold">변경확인</button>
                  </div>
                )}
                <button onClick={() => { setIsEditing(false); setIsCodeSent(false); }} className="text-gray-400 text-[10px] block w-full text-center">취소</button>
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
