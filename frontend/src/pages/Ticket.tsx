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

  const handleManualVerify = useCallback(() => {
    if (window.confirm("기사님 확인을 받으셨나요? 확인 버튼을 누르면 탑승 처리가 됩니다.")) {
      setIsScanned(true);
      alert("탑승 확인되었습니다.");
    }
  }, []);

  const goToNFCScanPage = () => {
    navigate(`/nfc-scan/${id}`);
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
        const routeRes = await api.get("/routes");
        const currentRoute = routeRes.data.find((r: BusRoute) => r.id === Number(id));

        if (!currentRoute) {
          alert("노선 정보를 찾을 수 없습니다.");
          navigate("/");
          return;
        }

        setRouteInfo(currentRoute);
        setIsFree(checkIsFreeRoute(currentRoute.route_name));

        await api.post("/bookings/reserve", null, {
          params: { user_id: parseInt(rawUserId), route_id: id }
        });

        setLoading(false);
      } catch (error: any) {
        alert(error.response?.data?.detail || "예약 오류");
        navigate("/");
      }
    };

    if (id) processReservation();
  }, [id, navigate]);

  if (loading) return <div className="min-h-screen bg-blue-600 flex items-center justify-center text-white">처리 중...</div>;

  return (
    <div className={`min-h-screen ${isScanned ? "bg-green-500" : "bg-blue-600"} p-6 flex flex-col items-center justify-center transition-all`}>
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-8 text-center border-b-2 border-dashed border-gray-100 relative">
          <div className="text-blue-600 font-bold mb-2 text-[10px] uppercase tracking-widest">
            {isFree ? "Campus Shuttle Pass" : "City-Express Pass"}
          </div>
          <h2 className="text-2xl font-black text-gray-900">{routeInfo?.route_name}</h2>
          <p className="text-gray-400 mt-1 text-sm">{routeInfo?.time} 출발</p>
        </div>

        <div className="p-8">
          <div className="flex justify-between mb-8 text-sm">
            <div>
              <p className="text-gray-400 font-bold mb-1 uppercase text-[10px]">Status</p>
              <p className={`font-bold ${isScanned ? "text-green-500" : "text-blue-600"}`}>
                {isScanned ? "탑승 완료" : "사용 가능"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 font-bold mb-1 uppercase text-[10px]">Fare</p>
              <p className="font-bold text-gray-900">{isFree ? "무료" : "3,000P"}</p>
            </div>
          </div>

          {!isScanned && (
            <div className="flex flex-col gap-3">
              {hasNFC ? (
                <button onClick={goToNFCScanPage} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg">
                  NFC 스캔하러 가기
                </button>
              ) : (
                <div className="bg-orange-50 p-3 rounded-xl text-orange-700 text-[11px] text-center">
                  기기에서 NFC를 지원하지 않습니다.
                </div>
              )}
              <button onClick={handleManualVerify} className={`w-full py-4 border-2 ${hasNFC ? "border-gray-100 text-gray-400" : "border-blue-600 text-blue-600"} rounded-2xl font-bold`}>
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
