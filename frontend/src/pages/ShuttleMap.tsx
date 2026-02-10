import React, { useEffect, useState } from 'react';
import EtaFloatingBar from '../components/EtaFloatingBar';
import api from '../utils/api'; 

// ✅ 전역 타입 선언을 BusTrackingPage와 동일하게 'any'로 통일하여 충돌 방지
declare global {
  interface Window {
    kakao: any;
  }
}

const ShuttleMap: React.FC = () => {
  // ✅ TS6133 해결: 사용하지 않는 setMap 제거
  const [etaData, setEtaData] = useState<{ duration_min: number; distance_km: number } | null>(null);

  const updateETA = async (busPos: string, stationPos: string) => {
    try {
      const res = await api.get(`/api/shuttle/precise-eta`, {
        params: { origin: busPos, destination: stationPos }
      });
      setEtaData(res.data);
    } catch (err) {
      console.error("ETA 업데이트 실패:", err);
    }
  };

  useEffect(() => {
    const container = document.getElementById('map');
    // ✅ window.kakao가 로드되었는지 안전하게 확인
    if (!container || !window.kakao || !window.kakao.maps) return;

    const options = {
      center: new window.kakao.maps.LatLng(35.858, 128.855),
      level: 4
    };
    
    // ✅ 지도 객체 생성 (변수에 할당하지 않아도 지도는 그려집니다)
    new window.kakao.maps.Map(container, options);

    const busCoord = "128.855,35.858"; 
    const stationCoord = "128.729,35.877"; 

    updateETA(busCoord, stationCoord);
    const interval = setInterval(() => updateETA(busCoord, stationCoord), 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden">
      {etaData && (
        <EtaFloatingBar 
          busName="경주 1호차"
          stationName="안심역"
          duration={etaData.duration_min}
          distance={etaData.distance_km}
        />
      )}

      <div id="map" className="w-full h-full z-0"></div>

      <div className="absolute right-4 bottom-24 flex flex-col gap-3 z-10">
        <button 
          onClick={() => window.location.reload()}
          className="p-4 bg-white/80 backdrop-blur-md rounded-full shadow-2xl border border-gray-100 text-lg"
        >
          🔄
        </button>
        <button 
          className="p-4 bg-blue-600 text-white rounded-full shadow-2xl text-lg"
          onClick={() => alert("현재 위치로 이동합니다.")}
        >
          📍
        </button>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-white p-4 rounded-2xl shadow-xl z-10 border border-gray-50">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-bold text-gray-800">경주 1호차</h4>
            <p className="text-xs text-gray-500 font-medium">실시간 위치 추적 중...</p>
          </div>
          <div className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-bold">
            운행 중
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShuttleMap;
