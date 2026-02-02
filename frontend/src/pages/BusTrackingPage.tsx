import { useEffect, useRef, useState } from "react";

/**
 * Kakao Maps API 타입 정의
 */
interface KakaoLatLng {
  getLat: () => number;
  getLng: () => number;
}

interface KakaoMarker {
  setPosition: (latlng: KakaoLatLng) => void;
  setMap: (map: KakaoMap | null) => void;
}

interface KakaoMap {
  setCenter: (latlng: KakaoLatLng) => void;
  setLevel: (level: number) => void;
}

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void;
        LatLng: new (lat: number, lng: number) => KakaoLatLng;
        Map: new (container: HTMLElement, options: unknown) => KakaoMap;
        Marker: new (options: unknown) => KakaoMarker;
      };
    };
  }
}

// [핵심] 백엔드 주소 설정 (끝에 슬래시 없이)
const BACKEND_URL = "https://umbrellalike-multiseriate-cythia.ngrok-free.dev";

export const BusTrackingPage = ({ routeId }: { routeId: number }) => {
  const mapContainer = useRef<HTMLDivElement>(null);

  const [map, setMap] = useState<KakaoMap | null>(null);
  const [busMarker, setBusMarker] = useState<KakaoMarker | null>(null);
  const [userMarker, setUserMarker] = useState<KakaoMarker | null>(null);

  const [eta, setEta] = useState<number | null>(null);
  const [routeName, setRouteName] = useState("");

  // 1. 카카오 맵 초기화
  useEffect(() => {
    const { kakao } = window;
    if (!kakao || !mapContainer.current) return;

    kakao.maps.load(() => {
      if (!mapContainer.current) return;

      const options = {
        center: new kakao.maps.LatLng(35.912, 128.807), // 초기 중심점
        level: 4,
      };

      const newMap = new kakao.maps.Map(mapContainer.current, options);
      setMap(newMap);

      const newBusMarker = new kakao.maps.Marker({ map: newMap });
      const newUserMarker = new kakao.maps.Marker({ map: newMap });

      setBusMarker(newBusMarker);
      setUserMarker(newUserMarker);
    });
  }, []);

  // 2. 위치 업데이트 및 API 통신
  useEffect(() => {
    if (!map || !busMarker || !userMarker) return;

    const updateLocation = async () => {
      try {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const { kakao } = window;

          // 내 위치 마커 업데이트
          const userLoc = new kakao.maps.LatLng(lat, lng);
          userMarker.setPosition(userLoc);

          // API 요청 (백틱 기호와 변수 활용)
          const res = await fetch(
            `${BACKEND_URL}/api/bus/track/${routeId}?user_lat=${lat}&user_lng=${lng}`,
            {
              headers: {
                "ngrok-skip-browser-warning": "69420",
              },
            },
          );

          if (!res.ok) {
            console.error(`서버 응답 에러: ${res.status}`);
            return;
          }

          const data = await res.json();

          // [방어 코드] 데이터가 있고, 필요한 좌표 정보가 있는지 확인
          if (data && data.status !== "error" && data.bus_location) {
            const busLoc = new kakao.maps.LatLng(
              data.bus_location.lat,
              data.bus_location.lng,
            );
            busMarker.setPosition(busLoc);
            setEta(data.eta);
            setRouteName(data.route_name);
          }
        });
      } catch (err) {
        console.error("위치 갱신 실패:", err);
      }
    };

    const timer = setInterval(updateLocation, 5000); // 5초마다 갱신
    updateLocation();
    return () => clearInterval(timer);
  }, [map, busMarker, userMarker, routeId]);

  return (
    <div className="relative w-full h-screen bg-gray-100 overflow-hidden">
      {/* 지도 영역 */}
      <div ref={mapContainer} className="w-full h-full z-0" />

      {/* 상단 레이아웃 */}
      <div className="absolute top-10 left-0 right-0 px-6 z-10">
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-[2.5rem] shadow-xl border border-white/50 text-center">
          <p className="text-blue-600 font-black text-[10px] tracking-widest mb-1 uppercase">
            Live Tracking
          </p>
          <h2 className="text-xl font-black text-gray-900 leading-tight">
            {routeName || "셔틀버스 위치 확인 중..."}
          </h2>
        </div>
      </div>

      {/* 하단 정보 카드 */}
      <div className="absolute bottom-16 left-0 right-0 px-8 z-10">
        <div className="bg-gray-900/95 backdrop-blur-sm text-white rounded-[3rem] p-8 shadow-2xl flex justify-between items-center border border-gray-700">
          <div>
            <span className="text-gray-400 text-xs font-bold mb-1 block">
              도착 예정
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-black text-blue-400">
                {eta !== null ? eta : "--"}
              </span>
              <span className="text-xl font-bold">분</span>
            </div>
          </div>
          <button className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-5 rounded-[2rem] font-black shadow-lg shadow-blue-500/30 active:scale-95 transition-all">
            알림 신청
          </button>
        </div>
      </div>
    </div>
  );
};
