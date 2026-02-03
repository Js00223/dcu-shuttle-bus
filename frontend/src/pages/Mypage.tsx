import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { logout } from "../utils/auth";

// [추가] 백엔드 주소 정의 (PointAndPass.tsx와 동일해야 함)
const BACKEND_URL =
  "https://dcu-shuttle-bus.onrender.com";

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
      const response = await axios.get(`${BACKEND_URL}/api/user/status`, {
        // [수정] 전체 URL 사용
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "ngrok-skip-browser-warning": "69420", // [추가] ngrok 우회 헤더
        },
      });

      if (response.data) {
        setStudentId(response.data.studentId || "20231234");
        setPoints(response.data.points ?? 0);
        setPhone(response.data.phone || "010-0000-0000");
        setTempPhone(response.data.phone || "010-0000-0000");
      }
    } catch (error) {
      console.error("마이페이지 데이터 동기화 실패:", error);
      // 실패 시 로컬 백업 유지
      setStudentId(localStorage.getItem("studentId") || "20231234");
      setPoints(Number(localStorage.getItem("points")) || 0);
      setPhone(localStorage.getItem("phone") || "010-1234-5678");
    } finally {
      setLoading(false);
    }
  }, []);

  // 마이페이지가 열릴 때마다 최신 데이터를 가져옵니다.
  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // [기능 2] 연락처 수정
  const handleSavePhone = async () => {
    try {
      await axios.post(
        `${BACKEND_URL}/user/update-phone`, // [수정] 전체 URL 사용
        { phone: tempPhone },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "ngrok-skip-browser-warning": "69420", // [추가] ngrok 우회 헤더
          },
        },
      );

      setPhone(tempPhone);
      localStorage.setItem("phone", tempPhone);
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
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col p-6">
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
