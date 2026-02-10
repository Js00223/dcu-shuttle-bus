import React, { useEffect, useState } from 'react';
import EtaFloatingBar from '../components/EtaFloatingBar';
import axios from 'axios';

declare global {
  interface Window {
    kakao: any;
  }
}

const BACKEND_URL = "https://dcu-shuttle-bus.onrender.com/api";

const ShuttleMap: React.FC = () => {
  const [etaData, setEtaData] = useState<{ duration_min: number; distance_km: number } | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  // ✅ 사용하지 않던 isLoading 변수를 제거하거나, 아래와 같이 로딩 UI에 활용합니다.
  const [isProcessing, setIsProcessing] = useState(true);

  const updateETA = async (busLng: number, busLat: number, userLng: number, userLat: number) => {
    try {
      setErrorType(null);
      setIsProcessing(true); // 계산 시작
      
      const origin = `${busLng.toFixed(6)},${busLat.toFixed(6)}`;
      const destination = `${userLng.toFixed(6)},${userLat.toFixed(6)}`;

      const res = await axios.get(`${BACKEND_URL}/shuttle/precise-eta`, {
        params: { origin, destination },
        timeout: 7000
      });
      
      if (res.data && typeof res.data.duration_min === 'number') {
        setEtaData(res.data);
      }
    } catch (err: any) {
      console.error("ETA 업데이트 실패:", err.response?.status, err.response?.data);
      setErrorType(err.response?.status === 400 ? "INVALID_PARAMS" : "SERVER_ERROR");
    } finally {
      setIsProcessing(false); // 계산 종료
    }
  };

  useEffect(() => {
    const container = document.getElementById('map');
    if (!container || !window.kakao || !window.kakao.maps) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const currentPos = new window.kakao.maps.LatLng(latitude, longitude);

        const options = { center: currentPos, level: 4 };
        const kakaoMap = new window.kakao.maps.Map(container, options);

        // 내 위치 마커
        new window.kakao.maps.Marker({ position: currentPos, map: kakaoMap });

        // 테스트용 버스 위치 (하양역 인근)
        const busLat = 35.912258;
        const busLng = 128.807612;
        const busPos = new window.kakao.maps.LatLng(busLat, busLng);
        new window.kakao.maps.Marker({ position: busPos, map: kakaoMap });

        updateETA(busLng, busLat, longitude, latitude);
      },
      () => {
        setIsProcessing(false);
        setErrorType("GPS_DENIED");
      },
      { enableHighAccuracy: true }
    );
  }, []);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#F2F2F7]">
      {/* 플로팅 UI 레이어 */}
      <div className="absolute top-0 left-0 right-0 z-50 px-4 pt-12 pointer-events-none">
        <div className="pointer-events-auto">
          {/* 1. 데이터가 정상적으로 왔을 때 */}
          {etaData && !errorType && !isProcessing && (
            <EtaFloatingBar 
              busName="경주 1호차"
              stationName="내 위치"
              duration={etaData.duration_min}
              distance={etaData.distance_km}
            />
          )}

          {/* 2. 에러가 발생했을 때 */}
          {errorType && (
            <div className="w-full h-20 bg-white/95 backdrop-blur-md rounded-[2.5rem] shadow-xl flex items-center justify-between px-8 border border-red-100">
              <div className="flex flex-col">
                <span className="text-red-600 font-bold text-sm">
                  {errorType === "INVALID_PARAMS" ? "데이터 전송 오류" : "시스템 일시 장애"}
                </span>
                <span className="text-gray-400 text-[10px]">
                  {errorType === "GPS_DENIED" ? "위치 권한을 허용해주세요." : "서버 응답을 확인 중입니다."}
                </span>
              </div>
              <button 
                onClick={() => window.location.reload()} 
                className="text-[11px] font-black text-blue-600 px-3 py-1 bg-blue-50 rounded-full"
              >
                재시도
              </button>
            </div>
          )}

          {/* 3. 로딩 중일 때 (isProcessing 활용) */}
          {isProcessing && !errorType && (
            <div className="w-full h-20 bg-white/90 backdrop-blur-md rounded-[2.5rem] shadow-lg flex items-center justify-center border border-white/50">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                <span className="text-sm font-bold text-gray-500 tracking-tight">실시간 경로 분석 중...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 지도 영역 */}
      <div id="map" className="w-full h-full z-0"></div>

      {/* 하단 내 위치 버튼 */}
      <div className="absolute right-4 bottom-28 z-40">
        <button 
          onClick={() => window.location.reload()}
          className="w-14 h-14 bg-white/90 backdrop-blur-sm rounded-full shadow-2xl border border-gray-100 flex items-center justify-center active:scale-90 transition-all text-xl"
        >
          📍
        </button>
      </div>
    </div>
  );
};

export default ShuttleMap;
