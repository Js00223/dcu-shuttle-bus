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
  const [isProcessing, setIsProcessing] = useState(true);

  const updateETA = async (busLng: number, busLat: number, userLng: number, userLat: number) => {
    try {
      setErrorType(null);
      setIsProcessing(true);
      
      const origin = `${busLng.toFixed(6)},${busLat.toFixed(6)}`;
      const destination = `${userLng.toFixed(6)},${userLat.toFixed(6)}`;

      // ✅ /api/api 중복 방지를 위해 BACKEND_URL을 직접 사용
      const res = await axios.get(`${BACKEND_URL}/shuttle/precise-eta`, {
        params: { origin, destination },
        timeout: 8000
      });
      
      if (res.data && typeof res.data.duration_min === 'number') {
        setEtaData(res.data);
      }
    } catch (err: any) {
      console.error("ETA API Error:", err);
      setErrorType("SERVER_ERROR");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const container = document.getElementById('map');
    if (!container || !window.kakao || !window.kakao.maps) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const currentPos = new window.kakao.maps.LatLng(latitude, longitude);

        const kakaoMap = new window.kakao.maps.Map(container, { center: currentPos, level: 4 });

        // 내 위치 마커
        new window.kakao.maps.Marker({ position: currentPos, map: kakaoMap, title: "내 위치" });

        // 테스트 버스 위치 (도로 인근 좌표로 보정)
        const busLat = 35.9121;
        const busLng = 128.8078;
        const busPos = new window.kakao.maps.LatLng(busLat, busLng);
        new window.kakao.maps.Marker({ position: busPos, map: kakaoMap, title: "셔틀버스" });

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
    <div className="relative w-full h-[100dvh] overflow-hidden bg-gray-50">
      <div className="absolute top-0 left-0 right-0 z-50 px-4 pt-12 pointer-events-none">
        <div className="pointer-events-auto">
          {etaData && !errorType && !isProcessing && (
            <EtaFloatingBar 
              busName="경주 1호차"
              stationName="내 위치"
              duration={etaData.duration_min}
              distance={etaData.distance_km}
            />
          )}

          {isProcessing && (
            <div className="w-full h-20 bg-white/90 backdrop-blur-md rounded-[2.5rem] shadow-lg flex items-center justify-center">
              <span className="text-sm font-bold text-blue-600 animate-pulse">실시간 교통 정보 분석 중...</span>
            </div>
          )}

          {errorType && !isProcessing && (
            <div className="w-full h-20 bg-white/95 rounded-[2.5rem] shadow-xl flex items-center justify-center border border-red-100">
              <span className="text-red-500 font-bold text-sm">정보를 불러올 수 없습니다.</span>
            </div>
          )}
        </div>
      </div>

      <div id="map" className="w-full h-full z-0"></div>

      <button 
        onClick={() => window.location.reload()}
        className="absolute right-4 bottom-28 z-40 w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-xl active:scale-90 transition-all"
      >
        📍
      </button>
    </div>
  );
};

export default ShuttleMap;
