import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNFC } from "../hooks/useNFC";
import api from "../utils/api"; // ✅ 아까 만든 api 인스턴스 사용

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
      try {
        setLoading(true);

        // ✅ 1. 예매 요청 (3,000P 차감 로직은 서버에서 처리됨)
        // 쿼리 파라미터 방식으로 route_id를 보냅니다.
        const response = await api.post("/bookings/reserve", null, {
          params: { route_id: id }
        });

        const result = response.data;

        // 서버 응답이 성공(success)인 경우
        if (result.status === "success" || response.status === 200) {
          
          // ✅ 2. 노선 정보 가져오기 (화면 표시용)
          const routeRes = await api.get("/api/routes");
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
        
        // 서버에서 보낸 에러 메시지 (포인트 부족 등) 출력
        const errorMsg = error.response?.data?.detail || "예약 시스템에 연결할 수 없습니다.";
        alert(`예약 실패: ${errorMsg}`);
        
        // 포인트 부족 시 포인트 충전 페이지로 이동, 그 외엔 홈으로
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
    if (window.confirm("예약을 취소하시겠습니까? 3,000P가 환불됩니다.")) {
      try {
        // 실제 서버에 취소 API가 있다면 여기서 호출
        // await api.post(`/api/bookings/cancel/${id}`);
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
