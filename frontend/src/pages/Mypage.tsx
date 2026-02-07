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

      // 서버 API 호출 (수정된 백엔드에서 favorites를 같이 보내줌)
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

        // ✅ [중요] 다른 기기에서 추가한 즐겨찾기 목록을 현재 기기 로컬스토리지에 동기화
        if (data.favorites) {
          localStorage.setItem("bus-favorites", JSON.stringify(data.favorites));
        }

        // 유저 정보 최신화
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
      localStorage.setItem("user", JSON.stringify({ ...user, phone: tempPhone }));
      setIsEditing(false);
      alert("연락처가 서버에 저장되었습니다.");
    } catch (error) {
      alert("서버 저장 실패");
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
              <div className="flex gap-2">
                <input type="text" value={tempPhone} onChange={(e) => setTempPhone(e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
                <button onClick={handleSavePhone} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold">저장</button>
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
