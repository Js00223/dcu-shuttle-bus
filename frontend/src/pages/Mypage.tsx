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

  // 중복 요청 방지를 위한 Ref
  const isFetching = useRef(false);

  // [기능 1] 서버로부터 유저 정보 가져오기
  const fetchUserData = useCallback(async () => {
    // 이미 데이터를 가져오는 중이라면 중복 실행 방지
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

      // 서버 API 호출
      const response = await api.get("/user/status", {
        params: { user_id: userId }
      });

      if (response.data) {
        const data = response.data;
        const dynamicStudentId = 
          data.studentId || 
          data.email?.split("@")[0] || 
          user.studentId || 
          "정보 없음";

        setStudentId(dynamicStudentId);
        setPoints(data.points ?? 0);
        setPhone(data.phone || "연락처 미등록");
        setTempPhone(data.phone || "");

        // 로컬스토리지 최신화
        localStorage.setItem("user", JSON.stringify({ 
          ...user, 
          ...data, 
          studentId: dynamicStudentId 
        }));
      }
    } catch (error: any) {
      // Aborted 에러는 로그에 찍지 않음 (정상적인 취소 과정일 수 있음)
      if (error.code !== 'ERR_CANCELED') {
        console.error("마이페이지 데이터 동기화 실패:", error);
      }
      
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setPoints(user.points || 0);
      setPhone(user.phone || "연락처 미등록");
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, []);

  // 컴포넌트 마운트 시 한 번만 실행되도록 보장
  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // [기능 2] 연락처 수정
  const handleSavePhone = async () => {
    if (!tempPhone.trim()) return;
    
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      await api.post("/user/update-phone", { 
        user_id: userId,
        phone: tempPhone 
      });

      // 성공 시 상태 업데이트
      setPhone(tempPhone);
      const updatedUser = { ...user, phone: tempPhone };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      
      setIsEditing(false);
      alert("연락처가 성공적으로 서버에 저장되었습니다.");
    } catch (error) {
      console.error("연락처 수정 실패:", error);
      alert("서버 저장에 실패했습니다.");
    }
  };

  // [기능 3] 회원 탈퇴
  const handleDeleteAccount = async () => {
    if (!window.confirm("정말로 탈퇴하시겠습니까?")) return;
    
    const password = window.prompt("본인 확인을 위해 비밀번호를 입력해주세요.");
    if (!password) return;

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      const response = await api.post("/auth/delete-account", {
        user_id: userId,
        password: password
      });

      if (response.data.status === "success") {
        alert("회원 탈퇴가 완료되었습니다.");
        localStorage.clear();
        navigate("/"); 
      }
    } catch (error: any) {
      alert(error.response?.data?.detail || "비밀번호가 틀렸습니다.");
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
        <div className="w-20 h-20 bg-[#E8E8ED] rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl text-gray-400">👤</span>
        </div>

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-[#8E8E93] text-[10px] font-bold uppercase tracking-widest mb-1">Student ID</p>
            <h2 className="text-xl font-black text-gray-900">{studentId}</h2>
          </div>

          <hr className="border-gray-50" />

          <div className="flex justify-between items-center px-4">
            <span className="text-gray-500 font-bold">남은 포인트</span>
            <span className="text-blue-600 font-black text-lg">
              {(points ?? 0).toLocaleString()} P
            </span>
          </div>

          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-[#8E8E93] text-[10px] font-bold uppercase tracking-widest mb-2">Contact</p>
            {isEditing ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tempPhone}
                  onChange={(e) => setTempPhone(e.target.value)}
                  className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleSavePhone}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold"
                >저장</button>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-gray-800 font-bold">{phone}</span>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-blue-600 text-xs font-bold underline underline-offset-4"
                >수정하기</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-3 pb-8">
        <button onClick={logout} className="w-full py-5 bg-white text-gray-400 rounded-[1.5rem] font-bold text-lg border border-gray-200">
          로그아웃
        </button>
        <button onClick={handleDeleteAccount} className="w-full py-4 text-red-400 rounded-[1.5rem] font-medium text-sm opacity-60">
          회원 탈퇴하기
        </button>
      </div>
    </div>
  );
};
