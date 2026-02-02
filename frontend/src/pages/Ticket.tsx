import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNFC } from "../hooks/useNFC";

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
  const [isScanned, setIsScanned] = useState(false); // [해결] 아래 handleScanSuccess에서 사용

  // [해결] 훅의 반환 타입을 확인하세요.
  // 에러 메시지에 따르면 startScanning만 존재하므로, 그에 맞춰 구조분해 할당을 수정합니다.
  const { startScanning } = useNFC();

  // [해결] 스캔 성공 시 실행될 함수
  const handleScanSuccess = useCallback(() => {
    setIsScanned(true);
    alert("인증되었습니다. 탑승해 주세요!");
  }, []);

  useEffect(() => {
    const processReservation = async () => {
      try {
        const response = await fetch(
          `https://umbrellalike-multiseriate-cythia.ngrok-free.dev/api/bookings/reserve?route_id=${id}`,
          {
            method: "POST",
          },
        );
        const result = await response.json();

        if (result.status === "success") {
          const routeRes = await fetch(
            `https://umbrellalike-multiseriate-cythia.ngrok-free.dev/api/routes`,
          );
          const routes: BusRoute[] = await routeRes.json();
          const currentRoute = routes.find((r) => r.id === Number(id));

          setRouteInfo(currentRoute || null);
          setLoading(false);

          // 예약 성공 후 스캔 유도
          if (
            window.confirm(
              "NFC 탑승 확인을 위해 단말기에 태그할 준비를 해주세요.",
            )
          ) {
            startScanning();
            // 실제 환경에서는 NFC 태그가 감지되면 자동으로 setIsScanned가 호출되어야 합니다.
            // 여기서는 시뮬레이션을 위해 3초 후 성공 처리를 하는 예시를 넣을 수 있습니다.
            // setTimeout(handleScanSuccess, 3000);
          }
        } else {
          alert(result.message);
          navigate("/points");
        }
      } catch (e) {
        console.error("예약 오류:", e);
        alert("예약 시스템에 연결할 수 없습니다.");
        navigate("/");
      }
    };

    processReservation();
  }, [id, navigate, startScanning, handleScanSuccess]);

  const handleCancel = async () => {
    if (window.confirm("예약을 취소하시겠습니까? 3,000P가 환불됩니다.")) {
      alert("취소가 완료되었습니다.");
      navigate("/");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-600 flex items-center justify-center">
        <div className="text-white font-bold animate-pulse text-lg">
          티켓 발권 중...
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
          <p className="text-gray-400 mt-1">계명대학교 노선</p>

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
          예약 취소 (환불받기)
        </button>
      )}

      {/* 테스트용 버튼: 실제 NFC가 없을 때 UI 확인용 */}
      <button
        onClick={handleScanSuccess}
        className="mt-4 text-[10px] text-white/20 hover:text-white/40 transition-colors"
      >
        (개발자용) 스캔 성공 시뮬레이션
      </button>
    </div>
  );
};
