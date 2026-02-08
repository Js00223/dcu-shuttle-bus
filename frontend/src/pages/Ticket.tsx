import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNFC } from "../hooks/useNFC";
import api from "../utils/api"; 

interface BusRoute {
  id: number;
  route_name: string;
  time: string | null;
}

export const Ticket = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState<BusRoute | null>(null);
  const [isScanned, setIsScanned] = useState(false);

  const { startScanning } = useNFC();

  // 스캔 성공 시 실행될 함수
  const handleScanSuccess = useCallback(() => {
    setIsScanned(true);
    alert("인증되었습니다. 탑승해 주세요!");
  }, []);

  // 페이지 진입 시 자동으로 예매(포인트 차감) 진행
  useEffect(() => {
    const processReservation = async () => {
      // 🌟 [핵심 수정] 저장된 user_id 가져오기
      const rawUserId = localStorage.getItem("user_id");
      
      if (!rawUserId) {
        alert("로그인 정보가 없습니다. 다시 로그인해 주세요.");
        navigate("/login");
        return;
      }

      try {
        setLoading(true);

        // ✅ 1. 예매 요청 (user_id와 route_id를 모두 보냅니다)
        const response = await api.post("/bookings/reserve", null, {
          params: { 
            user_id: parseInt(rawUserId), // 유저 ID 추가
            route_id: id                  // 노선 ID
          }
        });

        const result = response.data;

        // 서버 응답이 성공인 경우
        if (result.status === "success" || response.status === 200) {
          
          // ✅ 2. 노선 정보 가져오기 (주소 통일: /routes)
          const routeRes = await api.get("/routes");
          const routes: BusRoute[] = routeRes.data;
          const currentRoute = routes.find((r) => r.id === Number(id));

          setRouteInfo(currentRoute || null);
          setLoading(false);

          // ✅ 3. NFC 스캔 유도
          if (
            window.confirm(
              "예매가 완료되었습니다 (3,000P 차감).\nNFC 탑승 확인을 위해 단말기에 태그할 준비를 해주세요."
            )
          ) {
            startScanning();
          }
        }
      } catch (error: any) {
        console.error("예약 오류:", error);
        
        const errorMsg = error.response?.data?.detail || "예약 시스템에 연결할 수 없습니다.";
        alert(`예약 실패: ${errorMsg}`);
        
        if (errorMsg.includes("포인트")) {
          navigate("/points");
        } else {
          navigate("/");
        }
      }
    };

    if (id) {
      processReservation();
    }
  }, [id, navigate, startScanning]);

  const handleCancel = async () => {
    const rawUserId = localStorage.getItem("user_id");
    if (window.confirm("예약을 취소하시겠습니까? 3,000P가 환불됩니다.")) {
      try {
        // 취소 시에도 누가 취소하는지 user_id를 함께 보냅니다.
        await api.post("/bookings/cancel", null, {
            params: {
                user_id: rawUserId,
                route_id: id
            }
        });
        alert("취소가 완료되었습니다. 3,000P가 환불되었습니다.");
        navigate("/");
      } catch (err) {
        alert("취소 처리 중 오류가 발생했습니다.");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-600 flex items-center justify-center">
        <div className="text-white font-bold animate-pulse text-lg">
          티켓 발권 및 3,000P 차감 중...
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${isScanned ? "bg-green-500" : "bg-blue-600"} p-6 flex flex-col items-center justify-center transition-colors duration-500`}
    >
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-500">
        <div className="p-8 text-center border-b-2 border-dashed border-gray-100 relative">
          <div className="text-blue-600 font-bold mb-2 tracking-widest text-xs">
            SHUTTLE PASS
          </div>
          <h2 className="text-3xl font-black text-gray-900">
            {routeInfo?.route_name}
          </h2>
          <p className="text-gray-400 mt-1">대구가톨릭대학교 노선</p>

          <div
            className={`absolute -bottom-3 -left-3 w-6 h-6 ${isScanned ? "bg-green-500" : "bg-blue-600"} rounded-full transition-colors`}
          ></div>
          <div
            className={`absolute -bottom-3 -right-3 w-6 h-6 ${isScanned ? "bg-green-500" : "bg-blue-600"} rounded-full transition-colors`}
          ></div>
        </div>

        <div className="p-8">
          <div className="flex justify-between mb-6">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">
                시간
              </p>
              <p className="text-lg font-bold">
                {routeInfo?.time || "수시 운행"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">
                상태
              </p>
              <p
                className={`text-lg font-bold ${isScanned ? "text-green-500" : "text-blue-600"}`}
              >
                {isScanned ? "탑승 완료" : "사용 가능"}
              </p>
            </div>
          </div>

          <div
            className={`${isScanned ? "bg-green-50" : "bg-gray-50"} rounded-2xl p-5 flex flex-col items-center gap-3 transition-colors`}
          >
            <div
              className={`w-full h-12 bg-white rounded-xl border ${isScanned ? "border-green-200" : "border-gray-200"} flex items-center justify-center`}
            >
              <span
                className={`text-xs font-bold ${isScanned ? "text-green-500" : "text-gray-400"} tracking-[0.5em]`}
              >
                {isScanned ? "VERIFIED" : "WAITING..."}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              {isScanned
                ? "인증이 완료되었습니다. 즐거운 통학 되세요!"
                : "휴대폰 뒷면을 버스 단말기에 태그해주세요."}
            </p>
          </div>
        </div>
      </div>

      {!isScanned && (
        <button
          onClick={handleCancel}
          className="mt-8 text-white/60 font-medium underline decoration-white/30"
        >
          예약 취소 (3,000P 환불받기)
        </button>
      )}

      {/* 테스트용 버튼 */}
      <button
        onClick={handleScanSuccess}
        className="mt-4 text-[10px] text-white/20 hover:text-white/40 transition-colors"
      >
        (개발자용) 스캔 성공 시뮬레이션
      </button>
    </div>
  );
};
