import React, { useEffect, useState } from 'react';
import EtaFloatingBar from '../components/EtaFloatingBar';
import api from '../utils/api'; 

// 카카오 지도 API를 위한 타입 선언
declare global {
  interface Window {
    kakao: any;
  }
}

const ShuttleMap: React.FC = () => {
  const [map, setMap] = useState<any>(null);
  const [etaData, setEtaData] = useState<{ duration_min: number; distance_km: number } | null>(null);

  // 1. 백엔드 API를 통해 실시간 ETA 정보 가져오기
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

  // 2. 지도 초기화 및 위치 주기적 갱신
  useEffect(() => {
    const container = document.getElementById('map');
    if (!container || !(window as any).kakao) return;

    const options = {
      center: new (window as any).kakao.maps.LatLng(35.858, 128.855),
      level: 4
    };
    const kakaoMap = new (window as any).kakao.maps.Map(container, options);
    setMap(kakaoMap);

    // 좌표 설정 (경도, 위도)
    const busCoord = "128.855,35.858"; 
    const stationCoord = "128.729,35.877"; 

    updateETA(busCoord, stationCoord);
    const interval = setInterval(() => updateETA(busCoord, stationCoord), 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden">
      {/* 상단 플로팅 ETA 바 */}
      {etaData && (
        <EtaFloatingBar 
          busName="경주 1호차"
          stationName="안심역"
          duration={etaData.duration_min}
          distance={etaData.distance_km}
        />
      )}

      {/* 카카오 지도 영역 */}
      <div id="map" className="w-full h-full z-0"></div>

      {/* 컨트롤 버튼 */}
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

      {/* 하단 정보 카드 */}
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

// ✅ 반드시 default export가 있어야 App.tsx에서 에러가 나지 않습니다.
export default ShuttleMap;
