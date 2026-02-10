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
  const [isLoading, setIsLoading] = useState(true);
  const [errorType, setErrorType] = useState<string | null>(null); // ✅ 에러 유형 기록

  const updateETA = async (busLng: number, busLat: number, userLng: number, userLat: number) => {
    try {
      setErrorType(null);
      
      // ✅ 400 에러 방지: 좌표를 소수점 6자리까지 고정하고 공백 없이 포맷팅
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
      // 400 에러면 '데이터 형식 오류', 그 외는 '서버 오류'
      setErrorType(err.response?.status === 400 ? "INVALID_PARAMS" : "SERVER_ERROR");
    } finally {
      setIsLoading(false);
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

        // 테스트용 버스 위치 (하양역)
        const busLat = 35.912258;
        const busLng = 128.807612;
        const busPos = new window.kakao.maps.LatLng(busLat, busLng);
        new window.kakao.maps.Marker({ position: busPos, map: kakaoMap });

        // ✅ 숫자 형태 그대로 전달 (함수 내부에서 포맷팅)
        updateETA(busLng, busLat, longitude, latitude);
      },
      () => {
        setIsLoading(false);
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
          {etaData && !errorType ? (
            <EtaFloatingBar 
              busName="경주 1호차"
              stationName="내 위치"
              duration={etaData.duration_min}
              distance={etaData.distance_km}
            />
          ) : errorType ? (
            // ✅ 에러 상황별 메시지 처리
            <div className="w-full h-20 bg-white/90 backdrop-blur-md rounded-[2.5rem] shadow-xl flex items-center justify-between px-8 border border-red-100">
              <div className="flex flex-col">
                <span className="text-red-600 font-bold text-sm">
                  {errorType === "INVALID_PARAMS" ? "데이터 전송 오류" : "시스템 일시 장애"}
                </span>
                <span className="text-gray-400 text-[10px]">
                  {errorType === "INVALID_PARAMS" ? "좌표 값이 올바르지 않습니다." : "잠시 후 다시 시도해주세요."}
                </span>
              </div>
              <button onClick={() => window.location.reload()} className="text-[10px] font-black text-blue-600 underline">재시도</button>
            </div>
          ) : (
            <div className="w-full h-20 bg-white/90 backdrop-blur-md rounded-[2.5rem] shadow-lg flex items-center justify-center">
              <span className="text-sm font-bold text-gray-400 animate-pulse">경로 계산 중...</span>
            </div>
          )}
        </div>
      </div>

      <div id="map" className="w-full h-full z-0"></div>
    </div>
  );
};

export default ShuttleMap;
