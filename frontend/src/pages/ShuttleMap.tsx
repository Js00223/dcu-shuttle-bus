// src/pages/ShuttleMap.tsx
import React, { useEffect, useState } from 'react';
import EtaFloatingBar from '../components/EtaFloatingBar';
import axios from 'axios';

const ShuttleMap: React.FC = () => {
  const [etaData, setEtaData] = useState<any>(null);

  const updateETA = async (busPos: string, stationPos: string) => {
    // 백엔드에서 만든 카카오 길찾기 API 연동 엔드포인트 호출
    const res = await axios.get(`/api/shuttle/precise-eta?origin=${busPos}&destination=${stationPos}`);
    setEtaData(res.data);
  };

  // 30초마다 위치 갱신 시뮬레이션
  useEffect(() => {
    const busPos = "128.855,35.858"; // 예시: 버스 실시간 GPS
    const stationPos = "128.729,35.877"; // 예시: 안심역
    
    updateETA(busPos, stationPos);
    const interval = setInterval(() => updateETA(busPos, stationPos), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-screen">
      {/* 1. 상단 플로팅 ETA 바 */}
      {etaData && (
        <EtaFloatingBar 
          busName="경주 1호차"
          stationName="안심역"
          duration={etaData.duration_min}
          distance={etaData.distance_km}
        />
      )}

      {/* 2. 카카오 지도 컨테이너 */}
      <div id="map" className="w-full h-full">
        {/* Kakao Map Init Logic... */}
      </div>

      {/* 3. 내 위치/새로고침 등 플로팅 버튼들 */}
      <div className="absolute right-4 bottom-24 flex flex-col gap-2">
        <button className="p-4 bg-white rounded-full shadow-xl">📍</button>
      </div>
    </div>
  );
};
