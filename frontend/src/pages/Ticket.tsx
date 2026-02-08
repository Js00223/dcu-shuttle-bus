import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNFC } from "../hooks/useNFC";
import api from "../utils/api"; 

interface BusRoute {
  id: number;
  route_name: string;
  time: string | null;
  location: string; // 지역 정보가 필요할 수 있음
}

export const Ticket = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState<BusRoute | null>(null);
  const [isScanned, setIsScanned] = useState(false);
  const [isFree, setIsFree] = useState(false); // 무료 노선 여부 상태

  const { startScanning } = useNFC();

  const handleScanSuccess = useCallback(() => {
    setIsScanned(true);
    alert("인증되었습니다. 탑승해 주세요!");
  }, []);

  // 🌟 무료 노선 판별 함수
  const checkIsFreeRoute = (routeName: string) => {
    // 무료 대상 키워드: 대구, 하양, 교내, 셔틀
    const freeKeywords = ["대구", "하양", "교내", "셔틀", "순환"];
    // 시외 노선 키워드: 구미, 포항, 울산, 경주
    const paidKeywords = ["구미", "포항", "울산", "경주"];

    // 노선 이름에 무료 키워드가 포함되어 있는지 확인
    return freeKeywords.some(keyword => routeName.includes(keyword));
  };

  useEffect(() => {
    const processReservation = async () => {
      const rawUserId = localStorage.getItem("user_id");
      
      if (!rawUserId) {
        alert("로그인 정보가 없습니다. 다시 로그인해 주세요.");
        navigate("/login");
        return;
      }

      try {
        setLoading(true);

        // 1. 먼저 노선 정보를 가져와서 요금 타입을 확인합니다.
        const routeRes = await api.get("/routes");
        const routes: BusRoute[] = routeRes.data;
        const currentRoute = routes.find((r) => r.id === Number(id));

        if (!currentRoute) {
          alert("노선 정보를 찾을 수 없습니다.");
          navigate("/");
          return;
        }

        setRouteInfo(currentRoute);
        
        // 🌟 무료/유료 판별
        const freeStatus = checkIsFreeRoute(currentRoute.route_name);
        setIsFree(freeStatus);

        // 2. 예매 요청 (서버에 무료 여부나 노선 ID를 보내면 서버가 알아서 판단하게 함)
        const response = await api.post("/bookings/reserve", null, {
          params: { 
            user_id: parseInt(rawUserId),
            route_id: id,
            is_free: freeStatus // 서버 참고용 데이터 추가
          }
        });

        if (response.status === 200 || response.data.status === "success") {
          setLoading(false);

          const confirmMsg = freeStatus 
            ? `[무료 노선] 예매가 완료되었습니다.\n태그 준비를 해주세요.` 
            : `[시외 노선] 3,000P가 차감되었습니다.\n태그 준비를 해주세요.`;

          if (window.confirm(confirmMsg)) {
            startScanning();
          }
        }
      } catch (error: any) {
        console.error("예약 오류:", error);
        const errorMsg = error.response?.data?.detail || "예약 시스템 오류";
        alert(`실패: ${errorMsg}`);
        
        if (errorMsg.includes("포인트")) navigate("/points");
        else navigate("/");
      }
    };

    if (id) processReservation();
  }, [id, navigate, startScanning]);

  const handleCancel = async () => {
    const rawUserId = localStorage.getItem("user_id");
    if (window.confirm(isFree ? "예약을 취소하시겠습니까?" : "예약을 취소하시겠습니까? 3,000P가 환불됩니다.")) {
      try {
        await api.post("/bookings/cancel", null, {
            params: { user_id: rawUserId, route_id: id }
        });
        alert("취소되었습니다.");
        navigate("/");
      } catch (err) {
        alert("취소 처리 중 오류가 발생했습니다.");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-600 flex items-center justify-center">
        <div className="text-white font-bold animate-pulse text-lg text-center">
          노선 확인 및 티켓 발권 중...<br/>
          <span className="text-sm font-normal opacity-70">(시외 노선은 3,000P가 차감됩니다)</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isScanned ? "bg-green-500" : "bg-blue-600"} p-6 flex flex-col items-center justify-center transition-colors`}>
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-8 text-center border-b-2 border-dashed border-gray-100 relative">
          <div className="text-blue-600 font-bold mb-2 tracking-widest text-xs">
            {isFree ? "FREE PASS" : "PREMIUM PASS"}
          </div>
          <h2 className="text-3xl font-black text-gray-900">{routeInfo?.route_name}</h2>
          <p className="text-gray-400 mt-1">{isFree ? "교내/대구권 무료 노선" : "시외권 유료 노선"}</p>
        </div>

        <div className="p-8">
          <div className="flex justify-between mb-6">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">요금</p>
              <p className="text-lg font-bold text-blue-600">{isFree ? "무료" : "3,000P"}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">상태</p>
              <p className={`text-lg font-bold ${isScanned ? "text-green-500" : "text-blue-600"}`}>
                {isScanned ? "탑승 완료" : "사용 가능"}
              </p>
            </div>
          </div>

          <div className={`${isScanned ? "bg-green-50" : "bg-gray-50"} rounded-2xl p-5 flex flex-col items-center gap-3`}>
            <div className={`w-full h-12 bg-white rounded-xl border flex items-center justify-center`}>
              <span className={`text-xs font-bold ${isScanned ? "text-green-500" : "text-gray-400"} tracking-[0.5em]`}>
                {isScanned ? "VERIFIED" : "WAITING..."}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 text-center">
              {isScanned ? "인증 완료! 즐거운 통학 되세요." : "휴대폰을 버스 단말기에 태그해주세요."}
            </p>
          </div>
        </div>
      </div>

      {!isScanned && (
        <button onClick={handleCancel} className="mt-8 text-white/60 font-medium underline">
          예약 취소 {!isFree && "(3,000P 환불)"}
        </button>
      )}
    </div>
  );
};
