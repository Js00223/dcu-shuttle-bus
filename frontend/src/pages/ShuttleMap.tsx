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
  const [isLoading, setIsLoading] = useState(true);

  const updateETA = async (busPos: string, userPos: string) => {
    try {
      // ✅ 수정: URL에서 '/api'를 제거합니다. (api 설정 파일에 이미 포함되어 있기 때문)
      // 결과적으로 dcu-shuttle-bus.onrender.com/api/shuttle/precise-eta 가 호출됩니다.
      const res = await api.get(`/shuttle/precise-eta`, {
        params: { origin: busPos, destination: userPos }
      });
      
      if (res.data) {
        setEtaData(res.data);
      }
    } catch (err) {
      console.error("ETA 업데이트 실패:", err);
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

        const options = {
          center: currentPos,
          level: 4
        };
        
        const kakaoMap = new window.kakao.maps.Map(container, options);

        // 내 위치 마커
        new window.kakao.maps.Marker({
          position: currentPos,
          map: kakaoMap,
          title: "내 위치"
        });

        // 버스 위치 (예시: 하양역 근처)
        const busLat = 35.912;
        const busLng = 128.807;
        const busPos = new window.kakao.maps.LatLng(busLat, busLng);

        new window.kakao.maps.Marker({
          position: busPos,
          map: kakaoMap,
          title: "셔틀버스"
        });

        // ✅ API 호출 파라미터 전달 (경도,위도 순서 준수)
        updateETA(`${busLng},${busLat}`, `${longitude},${latitude}`);
      },
      (error) => {
        console.error("GPS 권한 거부 또는 오류", error);
        setIsLoading(false);
        // GPS 실패 시 기본 위치 설정
        const defaultPos = new window.kakao.maps.LatLng(35.913, 128.807);
        new window.kakao.maps.Map(container, { center: defaultPos, level: 4 });
      },
      { enableHighAccuracy: true } // 정확도 높임
    );
  }, []);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-gray-50">
      {/* 플로팅 바 레이어 (z-50으로 최상단 고정) */}
      <div className="absolute top-0 left-0 right-0 z-50 px-4 pt-12 pointer-events-none">
        <div className="pointer-events-auto"> {/* 바 자체는 클릭 가능하게 */}
          {etaData ? (
            <EtaFloatingBar 
              busName="경주 1호차"
              stationName="내 위치"
              duration={etaData.duration_min}
              distance={etaData.distance_km}
            />
          ) : isLoading ? (
            <div className="w-full h-20 bg-white/90 backdrop-blur-md rounded-[2.5rem] shadow-lg flex items-center justify-center border border-white/50">
              <div className="flex gap-3 items-center">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                <span className="text-sm font-bold text-gray-600">교통 정보 분석 중...</span>
              </div>
            </div>
          ) : (
            // 데이터 로드 실패 시에도 화면이 깨지지 않게 빈 공간 유지 또는 안내
            <div className="w-full h-20 bg-white/50 backdrop-blur-md rounded-[2.5rem] flex items-center justify-center border border-dashed border-gray-300">
               <span className="text-xs text-gray-400 font-medium">교통 정보를 가져올 수 없습니다.</span>
            </div>
          )}
        </div>
      </div>

      {/* 지도 영역 */}
      <div id="map" className="w-full h-full z-0"></div>
      
      {/* 내 위치 버튼 */}
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
