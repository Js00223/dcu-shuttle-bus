import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../utils/api"; 

interface BusRoute {
  id: number;
  route_name: string;
  time: string | null;
  location: string;
}

export const Ticket = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState<BusRoute | null>(null);
  const [isScanned, setIsScanned] = useState(false);
  const [isFree, setIsFree] = useState(false);      
  const [hasNFC, setHasNFC] = useState(true);       
  const [isSoldOut, setIsSoldOut] = useState(false); // 매진 상태 추가

  const handleManualVerify = useCallback(() => {
    if (window.confirm("기사님 확인을 받으셨나요? 확인 버튼을 누르면 탑승 처리가 됩니다.")) {
      setIsScanned(true);
      alert("탑승 확인되었습니다.");
    }
  }, []);

  const goToNFCScanPage = () => {
    navigate(`/nfc-scan/${id}`);
  };

  // 🔔 빈자리 알림 신청 함수
  const handleNotifyMe = async () => {
    const rawUserId = localStorage.getItem("user_id");
    if (!rawUserId) return;

    try {
      await api.post("/api/shuttle/wait-list", {
        user_id: parseInt(rawUserId),
        route_id: parseInt(id || "0")
      });
      alert("🔔 빈자리 알림 신청이 완료되었습니다! 자리가 생기면 쪽지를 보내드릴게요.");
    } catch (error) {
      alert("알림 신청 중 오류가 발생했습니다.");
    }
  };

  // 🌟 시외 노선(울산, 경주, 구미, 포항) 여부 판별
  const checkIsFreeRoute = (routeName: string) => {
    const outOfCityKeywords = ["울산", "경주", "구미", "포항"];
    return !outOfCityKeywords.some(keyword => routeName.includes(keyword));
  };

  useEffect(() => {
    if (!("NDEFReader" in window)) {
      setHasNFC(false);
    }

    const processReservation = async () => {
      const rawUserId = localStorage.getItem("user_id");
      if (!rawUserId) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        // 1. 노선 정보 가져오기
        const routeRes = await api.get("/routes");
        const currentRoute = routeRes.data.find((r: BusRoute) => r.id === Number(id));

        if (!currentRoute) {
          alert("노선 정보를 찾을 수 없습니다.");
          navigate("/");
          return;
        }

        setRouteInfo(currentRoute);
        setIsFree(checkIsFreeRoute(currentRoute.route_name));

        // 2. 예약 시도
        await api.post("/bookings/reserve", null, {
          params: { user_id: parseInt(rawUserId), route_id: id }
        });

        setIsSoldOut(false);
        setLoading(false);
      } catch (error: any) {
        // 매진 등의 사유로 예약 실패 시
        const errorDetail = error.response?.data?.detail || "";
        if (errorDetail.includes("부족") || errorDetail.includes("매진") || error.response?.status === 400) {
          setIsSoldOut(true);
        }
        setLoading(false);
        // 에러 메시지 출력 (사용자가 인지할 수 있게)
        console.error("예약 실패:", errorDetail);
      }
    };

    if (id) processReservation();
  }, [id, navigate]);

  if (loading) return <div className="min-h-screen bg-blue-600 flex items-center justify-center text-white">처리 중...</div>;

  return (
    <div className={`min-h-screen ${isScanned ? "bg-green-500" : isSoldOut ? "bg-gray-800" : "bg-blue-600"} p-6 flex flex-col items-center justify-center transition-all`}>
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl">
        {/* 상단 헤더 */}
        <div className="p-8 text-center border-b-2 border-dashed border-gray-100 relative">
          <div className="text-blue-600 font-bold mb-2 text-[10px] uppercase tracking-widest">
            {isFree ? "Campus Shuttle Pass" : "City-Express Pass"}
          </div>
          <h2 className="text-2xl font-black text-gray-900">{routeInfo?.route_name}</h2>
          <p className="text-gray-400 mt-1 text-sm">{routeInfo?.time} 출발</p>
          
          {/* 매진 뱃지 */}
          {isSoldOut && (
            <div className="absolute top-4 right-4 bg-red-500 text-white text-[10px] px-2 py-1 rounded-md font-bold animate-pulse">
              매진
            </div>
          )}
        </div>

        {/* 중단 정보 */}
        <div className="p-8">
          <div className="flex justify-between mb-8 text-sm">
            <div>
              <p className="text-gray-400 font-bold mb-1 uppercase text-[10px]">Status</p>
              <p className={`font-bold ${isScanned ? "text-green-500" : isSoldOut ? "text-red-500" : "text-blue-600"}`}>
                {isScanned ? "탑승 완료" : isSoldOut ? "예약 불가 (매진)" : "사용 가능"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 font-bold mb-1 uppercase text-[10px]">Fare</p>
              <p className="font-bold text-gray-900">{isFree ? "무료" : "3,000P"}</p>
            </div>
          </div>

          {/* 하단 액션 버튼 */}
          {!isScanned && (
            <div className="flex flex-col gap-3">
              {isSoldOut ? (
                /* 매진 시 나타나는 알림 버튼 */
                <button 
                  onClick={handleNotifyMe}
                  className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors"
                >
                  <span>🔔</span> 빈자리 생기면 알림받기
                </button>
              ) : (
                /* 정상 예약 가능 시 */
                <>
                  {hasNFC ? (
                    <button onClick={goToNFCScanPage} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg">
                      NFC 스캔하러 가기
                    </button>
                  ) : (
                    <div className="bg-orange-50 p-3 rounded-xl text-orange-700 text-[11px] text-center">
                      기기에서 NFC를 지원하지 않습니다.
                    </div>
                  )}
                </>
              )}
              
              <button 
                onClick={handleManualVerify} 
                disabled={isSoldOut}
                className={`w-full py-4 border-2 ${isSoldOut ? "border-gray-100 text-gray-300 cursor-not-allowed" : hasNFC ? "border-gray-100 text-gray-400" : "border-blue-600 text-blue-600"} rounded-2xl font-bold`}
              >
                기사님 수동 확인
              </button>
            </div>
          )}

          {isScanned && (
            <div className="bg-green-50 rounded-2xl p-6 flex flex-col items-center border-2 border-green-100">
              <span className="text-green-600 font-black text-xl">승차 확인 완료</span>
            </div>
          )}
        </div>
      </div>
      
      {!isScanned && (
        <button onClick={() => navigate("/")} className="mt-8 text-white/60 font-medium underline text-sm">
          메인으로 이동
        </button>
      )}
    </div>
  );
};
