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
  const { id } = useParams(); // URL에서 노선 ID 추출
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState<BusRoute | null>(null);
  const [isScanned, setIsScanned] = useState(false); // 탑승 확인 여부
  const [isFree, setIsFree] = useState(false);      // 무료 노선 여부
  const [hasNFC, setHasNFC] = useState(true);       // 기기 NFC 지원 여부

  // 1. 수동 탑승 확인 처리 (NFC가 없거나 태그가 안 될 때)
  const handleManualVerify = useCallback(() => {
    if (window.confirm("기사님 확인을 받으셨나요? 확인 버튼을 누르면 탑승 처리가 됩니다.")) {
      setIsScanned(true);
      alert("탑승 확인되었습니다. 즐거운 통학 되세요!");
    }
  }, []);

  // 2. NFC 스캔 전용 페이지로 이동
  const goToNFCScanPage = () => {
    // 현재 노선 ID를 파라미터로 들고 이동합니다.
    navigate(`/nfc-scan/${id}`);
  };

  // 3. 무료 노선 키워드 체크 (프론트엔드 UI용)
  const checkIsFreeRoute = (routeName: string) => {
    const freeKeywords = ["대구", "하양", "교내", "셔틀", "순환"];
    return freeKeywords.some(keyword => routeName.includes(keyword));
  };

  useEffect(() => {
    // 🌟 브라우저/기기 NFC 지원 여부 초기 체크
    if (!("NDEFReader" in window)) {
      setHasNFC(false);
    }

    const processReservation = async () => {
      const rawUserId = localStorage.getItem("user_id");
      if (!rawUserId) {
        alert("로그인 정보가 없습니다.");
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        // 전체 노선 정보를 가져와 현재 티켓에 맞는 정보 찾기
        const routeRes = await api.get("/routes");
        const currentRoute = routeRes.data.find((r: BusRoute) => r.id === Number(id));

        if (!currentRoute) {
          alert("노선 정보를 찾을 수 없습니다.");
          navigate("/");
          return;
        }

        setRouteInfo(currentRoute);
        setIsFree(checkIsFreeRoute(currentRoute.route_name));

        // 백엔드에 예약 요청 (여기서 포인트가 차감되거나 무료 처리됨)
        const response = await api.post("/bookings/reserve", null, {
          params: { 
            user_id: parseInt(rawUserId), 
            route_id: id 
          }
        });

        if (response.status === 200) {
          setLoading(false);
        }
      } catch (error: any) {
        // 포인트 부족 등 에러 처리
        alert(error.response?.data?.detail || "예약 시스템 오류");
        navigate("/");
      }
    };

    if (id) processReservation();
  }, [id, navigate]);

  if (loading) return (
    <div className="min-h-screen bg-blue-600 flex items-center justify-center text-white font-bold">
      승차권을 준비 중입니다...
    </div>
  );

  return (
    <div className={`min-h-screen ${isScanned ? "bg-green-500" : "bg-blue-600"} p-6 flex flex-col items-center justify-center transition-colors font-sans`}>
      {/* 티켓 카드 디자인 */}
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl">
        
        {/* 상단 정보 영역 */}
        <div className="p-8 text-center border-b-2 border-dashed border-gray-100 relative">
          <div className="text-blue-600 font-bold mb-2 tracking-widest text-[10px] uppercase">
            {isFree ? "University Free Shuttle" : "City-to-Campus Express"}
          </div>
          <h2 className="text-2xl font-black text-gray-900 leading-tight">
            {routeInfo?.route_name}
          </h2>
          <p className="text-gray-400 mt-2 text-sm">
            {routeInfo?.time} 정시에 출발합니다
          </p>
          
          {/* 티켓 사이드 홈 (디자인 요소) */}
          <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-blue-600 rounded-full"></div>
          <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-blue-600 rounded-full"></div>
        </div>

        {/* 하단 상세 영역 */}
        <div className="p-8">
          <div className="flex justify-between mb-8">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Status</p>
              <p className={`text-lg font-bold ${isScanned ? "text-green-500" : "text-blue-600"}`}>
                {isScanned ? "탑승 완료" : "사용 가능"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Fare</p>
              <p className="text-lg font-bold text-gray-900">{isFree ? "무료" : "3,000P"}</p>
            </div>
          </div>

          {!isScanned && (
            <div className="flex flex-col gap-3">
              {/* NFC 기능이 있을 때만 스캔 페이지 이동 버튼 노출 */}
              {hasNFC ? (
                <button 
                  onClick={goToNFCScanPage}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-transform"
                >
                  NFC 태그하여 승차 확인
                </button>
              ) : (
                <div className="bg-orange-50 p-4 rounded-xl text-orange-700 text-[11px] mb-2 leading-tight">
                  이 기기는 NFC 기능을 지원하지 않거나 비활성화되어 있습니다. 
                  기사님 확인 후 아래 버튼을 사용해 주세요.
                </div>
              )}
              
              {/* 수동 확인 버튼 (NFC가 없으면 더 강조됨) */}
              <button 
                onClick={handleManualVerify}
                className={`w-full py-4 border-2 ${hasNFC ? "border-gray-100 text-gray-400" : "border-blue-600 text-blue-600"} rounded-2xl font-bold active:scale-95 transition-transform`}
              >
                기사님 수동 확인
              </button>
            </div>
          )}

          {/* 승차 확인 완료 UI */}
          {isScanned && (
            <div className="bg-green-50 rounded-2xl p-6 flex flex-col items-center gap-2 border-2 border-green-100 animate-pulse">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mb-2">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-green-600 font-black text-xl">승차 확인 완료</span>
              <p className="text-xs text-green-700 font-medium">안전하고 편안한 이동 되세요!</p>
            </div>
          )}
        </div>
      </div>
      
      {!isScanned && (
        <button onClick={() => navigate("/")} className="mt-8 text-white/60 font-medium underline text-sm">
          예약 취소 및 메인으로
        </button>
      )}
    </div>
  );
};
