import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import EtaFloatingBar from '../components/EtaFloatingBar';
import axios from 'axios';

declare global {
  interface Window {
    kakao: any;
  }
}

const BACKEND_URL = "https://dcu-shuttle-bus.onrender.com/api";

const ShuttleMap: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const routeId = queryParams.get('routeId'); // URL에서 routeId 추출

  const [etaData, setEtaData] = useState<{ duration_min: number; distance_km: number } | null>(null);
  const [routeName, setRouteName] = useState<string>("노선 확인 중...");
  const [errorType, setErrorType] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  // 1. 노선 정보 가져오기
  const fetchRouteDetail = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/routes`);
      const allRoutes = res.data;
      const currentRoute = allRoutes.find((r: any) => r.id === Number(routeId));
      if (currentRoute) {
        setRouteName(currentRoute.route_name);
      } else {
        setRouteName("알 수 없는 노선");
      }
    } catch (err) {
      setRouteName("셔틀 버스");
    }
  };

  // 2. ETA 업데이트
  const updateETA = async (busLng: number, busLat: number, userLng: number, userLat: number) => {
    try {
      setErrorType(null);
      setIsProcessing(true);
      
      const origin = `${busLng.toFixed(6)},${busLat.toFixed(6)}`;
      const destination = `${userLng.toFixed(6)},${userLat.toFixed(6)}`;

      const res = await axios.get(`${BACKEND_URL}/shuttle/precise-eta`, {
        params: { origin, destination },
        timeout: 8000
      });
      
      if (res.data && typeof res.data.duration_min === 'number') {
        setEtaData(res.data);
      }
    } catch (err: any) {
      setErrorType("SERVER_ERROR");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    fetchRouteDetail(); // 노선명 로드

    const container = document.getElementById('map');
    if (!container || !window.kakao || !window.kakao.maps) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const currentPos = new window.kakao.maps.LatLng(latitude, longitude);

        const kakaoMap = new window.kakao.maps.Map(container, { center: currentPos, level: 4 });

        // 내 위치 마커
        new window.kakao.maps.Marker({ position: currentPos, map: kakaoMap });

        // 실시간 버스 좌표 (실제로는 서버에서 받아와야 하나, 현재는 테스트용 도로 좌표)
        const busLat = 35.9121;
        const busLng = 128.8078;
        const busPos = new window.kakao.maps.LatLng(busLat, busLng);
        new window.kakao.maps.Marker({ 
            position: busPos, 
            map: kakaoMap,
            image: new window.kakao.maps.MarkerImage(
                'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
                new window.kakao.maps.Size(40, 40)
            )
        });

        updateETA(busLng, busLat, longitude, latitude);
      },
      () => {
        setIsProcessing(false);
        setErrorType("GPS_DENIED");
      },
      { enableHighAccuracy: true }
    );
  }, [routeId]);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-gray-50">
      <div className="absolute top-0 left-0 right-0 z-50 px-4 pt-12 pointer-events-none">
        <div className="pointer-events-auto">
          {etaData && !errorType && !isProcessing && (
            <EtaFloatingBar 
              busName={routeName} // ✅ 이제 "경주 1호차" 대신 동적 이름이 들어감
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
        </div>
      </div>

      <div id="map" className="w-full h-full z-0"></div>

      <button 
        onClick={() => window.location.reload()}
        className="absolute right-4 bottom-28 z-40 w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all"
      >
        📍
      </button>
    </div>
  );
};

export default ShuttleMap;
