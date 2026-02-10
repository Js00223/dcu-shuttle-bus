import React, { useEffect, useState } from 'react';
import EtaFloatingBar from '../components/EtaFloatingBar';
import axios from 'axios'; // ✅ 주소 꼬임 방지를 위해 axios 직접 임포트

declare global {
  interface Window {
    kakao: any;
  }
}

// ✅ 백엔드 기본 주소 설정
const BACKEND_URL = "https://dcu-shuttle-bus.onrender.com/api";

const ShuttleMap: React.FC = () => {
  const [etaData, setEtaData] = useState<{ duration_min: number; distance_km: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  /**
   * ✅ ETA 업데이트 함수
   * api 유틸리티 대신 axios 절대 경로를 사용하여 404/500 에러를 방지합니다.
   */
  const updateETA = async (busPos: string, userPos: string) => {
    try {
      setHasError(false);
      // 절대 경로 호출: https://dcu-shuttle-bus.onrender.com/api/shuttle/precise-eta
      const res = await axios.get(`${BACKEND_URL}/shuttle/precise-eta`, {
        params: { origin: busPos, destination: userPos }
      });
      
      if (res.data) {
        setEtaData(res.data);
      }
    } catch (err) {
      console.error("ETA 업데이트 실패 (404/500):", err);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const container = document.getElementById('map');
    if (!container || !window.kakao || !window.kakao.maps) return;

    // 현재 내 실제 위치 가져오기
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const currentPos = new window.kakao.maps.LatLng(latitude, longitude);

        const options = {
          center: currentPos,
          level: 4
        };
        
        const kakaoMap = new window.kakao.maps.Map(container, options);

        // 내 위치 마커 표시
        new window.kakao.maps.Marker({
          position: currentPos,
          map: kakaoMap,
          title: "내 위치"
        });

        // 셔틀버스 위치 (예시: 하양역 인근)
        const busLat = 35.912;
        const busLng = 128.807;
        const busPos = new window.kakao.maps.LatLng(busLat, busLng);

        new window.kakao.maps.Marker({
          position: busPos,
          map: kakaoMap,
          title: "셔틀버스"
        });

        // ✅ API 호출 (경도,위도 문자열 전달)
        updateETA(`${busLng},${busLat}`, `${longitude},${latitude}`);
      },
      (error) => {
        console.error("GPS 권한 거부 또는 오류", error);
        setIsLoading(false);
        // GPS 실패 시 기본 위치 설정 (학교 본관 등)
        const defaultPos = new window.kakao.maps.LatLng(35.913, 128.807);
        new window.kakao.maps.Map(container, { center: defaultPos, level: 4 });
      },
      { enableHighAccuracy: true }
    );
  }, []);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-gray-50">
      {/* 플로팅 UI 레이어 (z-50) */}
      <div className="absolute top-0 left-0 right-0 z-50 px-4 pt-12 pointer-events-none">
        <div className="pointer-events-auto">
          {etaData && !hasError ? (
            <EtaFloatingBar 
              busName="경주 1호차"
              stationName="내 위치"
              duration={etaData.duration_min}
              distance={etaData.distance_km}
            />
          ) : hasError ? (
            // ✅ 서버 에러(404/500) 발생 시 UI
            <div className="w-full h-20 bg-amber-50/90 backdrop-blur-md rounded-[2.5rem] shadow-lg flex items-center justify-center border border-amber-100">
              <div className="flex flex-col items-center">
                <span className="text-amber-700 font-bold text-sm">교통 정보 일시적 장애</span>
                <span className="text-amber-500 text-[10px]">서버 연결을 확인해주세요 (404/500)</span>
              </div>
            </div>
          ) : isLoading ? (
            // 로딩 중 UI
            <div className="w-full h-20 bg-white/90 backdrop-blur-md rounded-[2.5rem] shadow-lg flex items-center justify-center border border-white/50">
              <div className="flex gap-3 items-center">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                <span className="text-sm font-bold text-gray-600">교통 정보 분석 중...</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 지도 영역 */}
      <div id="map" className="w-full h-full z-0"></div>
      
      {/* 하단 플로팅 버튼 */}
      <div className="absolute right-4 bottom-28 z-40 flex flex-col gap-3">
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
