import React, { useEffect, useState } from 'react';
import EtaFloatingBar from '../components/EtaFloatingBar';
import api from '../utils/api'; 

declare global {
  interface Window {
    kakao: any;
  }
}

const ShuttleMap: React.FC = () => {
  const [etaData, setEtaData] = useState<{ duration_min: number; distance_km: number } | null>(null);

  // 1. ETA 업데이트 (백엔드 호출)
  const updateETA = async (busPos: string, userPos: string) => {
    try {
      const res = await api.get(`/api/shuttle/precise-eta`, {
        params: { origin: busPos, destination: userPos }
      });
      setEtaData(res.data);
    } catch (err) {
      console.error("ETA 업데이트 실패:", err);
    }
  };

  useEffect(() => {
    const container = document.getElementById('map');
    if (!container || !window.kakao || !window.kakao.maps) return;

    // 2. 현재 내 실제 위치 가져오기
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      
      // 카카오 좌표 객체 생성 (위도, 경도 순서 주의!)
      const currentPos = new window.kakao.maps.LatLng(latitude, longitude);

      const options = {
        center: currentPos, // 내 위치를 중심으로 지도 시작
        level: 4
      };
      
      const kakaoMap = new window.kakao.maps.Map(container, options);

      // 내 위치 마커 표시
      new window.kakao.maps.Marker({
        position: currentPos,
        map: kakaoMap
      });

      // 3. 버스 위치 (임시: 실제로는 백엔드에서 받아온 버스 좌표를 넣어야 함)
      // 하양역 인근 좌표 예시
      const busLat = 35.912;
      const busLng = 128.807;
      const busPos = new window.kakao.maps.LatLng(busLat, busLng);

      new window.kakao.maps.Marker({
        position: busPos,
        map: kakaoMap,
        title: "셔틀버스"
      });

      // 4. ETA 계산 요청 (경도,위도 문자열 포맷)
      const userCoordStr = `${longitude},${latitude}`;
      const busCoordStr = `${busLng},${busLat}`;
      updateETA(busCoordStr, userCoordStr);
    }, (error) => {
      console.error("GPS 정보를 가져올 수 없습니다.", error);
      // GPS 실패 시 기본 위치 (학교 본관 등)
      const defaultPos = new window.kakao.maps.LatLng(35.913, 128.807);
      new window.kakao.maps.Map(container, { center: defaultPos, level: 4 });
    });

  }, []);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden">
      {etaData && (
        <EtaFloatingBar 
          busName="대구가톨릭대 셔틀"
          stationName="내 위치"
          duration={etaData.duration_min}
          distance={etaData.distance_km}
        />
      )}
      <div id="map" className="w-full h-full z-0"></div>
      
      <div className="absolute right-4 bottom-24 z-10">
        <button 
          onClick={() => window.location.reload()}
          className="p-4 bg-white rounded-full shadow-2xl border font-bold text-blue-600"
        >
          내 위치로
        </button>
      </div>
    </div>
  );
};

export default ShuttleMap;
