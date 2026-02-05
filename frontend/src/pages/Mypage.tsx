import { useState, useEffect, useCallback } from "react";
import { logout } from "../utils/auth";
import api from "../utils/api"; 

export const MyPage = () => {
  const [studentId, setStudentId] = useState<string>("");
  const [points, setPoints] = useState<number>(0);
  const [phone, setPhone] = useState<string>("");

  const [isEditing, setIsEditing] = useState(false);
  const [tempPhone, setTempPhone] = useState("");
  const [loading, setLoading] = useState(true);

  // [기능 1] 서버로부터 유저 정보 가져오기
  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true);

      // 1. 로컬스토리지에서 로그인된 유저 ID 가져오기
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      if (!userId) {
        console.error("유저 ID가 없습니다. 로그인이 필요합니다.");
        return;
      }

      // 2. api 인스턴스 사용
      const response = await api.get("/user/status", {
        params: { user_id: userId }
      });

      if (response.data) {
        // ✅ [수정 파트] 학번 동적 결정 로직
        // 서버의 studentId -> 이메일 앞자리 -> 기존 로컬 스토리지 데이터 순으로 확인
        const dynamicStudentId = 
          response.data.studentId || 
          response.data.email?.split("@")[0] || 
          user.studentId || 
          "학번 정보 없음";

        setStudentId(dynamicStudentId);
        setPoints(response.data.points ?? 0);
        setPhone(response.data.phone || "010-0000-0000");
        setTempPhone(response.data.phone || "010-0000-0000");

        // 로컬 스토리지 데이터 최신화 (학번 정보 포함하여 저장)
        localStorage.setItem("user", JSON.stringify({ ...response.data, studentId: dynamicStudentId }));
      }
    } catch (error) {
      console.error("마이페이지 데이터 동기화 실패:", error);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setPoints(user.points || 0);
      setStudentId(user.studentId || user.email?.split("@")[0] || "20231234");
      setPhone(user.phone || "010-1234-5678");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // [기능 2] 연락처 수정
  const handleSavePhone = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      await api.post("/user/update-phone", { 
        user_id: userId,
        phone: tempPhone 
      });

      setPhone(tempPhone);
      // 로컬 스토리지 내 휴대폰 번호도 동기화
      const updatedUser = { ...user, phone: tempPhone };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      
      setIsEditing(false);
      alert("연락처가 서버에 저장되었습니다.");
    } catch (error) {
      console.error("연락처 수정 실패:", error);
      alert("수정사항을 서버에 저장하지 못했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center">
        <p className="text-gray-400 font-bold animate-pulse">
          정보 동기화 중...
        </p>
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
            <p className="text-[#8E8E93] text-[10px] font-bold uppercase tracking-widest mb-1">
              Student ID
            </p>
            {/* ✅ 동적으로 업데이트된 학번 표시 */}
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
            <p className="text-[#8E8E93] text-[10px] font-bold uppercase tracking-widest mb-2">
              Contact
            </p>
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
                >
                  저장
                </button>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-gray-800 font-bold">{phone}</span>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-blue-600 text-xs font-bold underline underline-offset-4"
                >
                  수정하기
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto pb-12">
        <button
          onClick={logout}
          className="w-full py-5 bg-red-50 text-red-500 rounded-[1.5rem] font-black text-lg transition-all active:bg-red-100"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
};
