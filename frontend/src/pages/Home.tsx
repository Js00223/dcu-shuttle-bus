import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RouteItem } from "../components/RouteItem";
import { Search } from "lucide-react";

// 노선 데이터 타입 정의
interface BusRoute {
  id: number;
  route_name: string;
  time: string | null;
  location: string;
}

export const Home = () => {
  const navigate = useNavigate();

  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // 즐겨찾기 상태 (로컬 스토리지 연동)
  const [favorites, setFavorites] = useState<number[]>(() => {
    const saved = localStorage.getItem("bus-favorites");
    return saved ? JSON.parse(saved) : [];
  });

  // 노선 데이터 불러오기
  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        setIsLoading(true);

        // 환경 변수에서 베이스 URL을 가져옵니다.
        // VITE_API_URL은 .env 파일에 정의되어 있어야 합니다.
        const API_BASE_URL = import.meta.env.VITE_API_URL || "";

        // 캐시 방지를 위해 URL 뒤에 현재 시간을 파라미터로 추가합니다.
        const url = `${API_BASE_URL}/api/routes?t=${Date.now()}`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            // ngrok 경고 페이지를 건너뛰기 위한 필수 헤더
            "ngrok-skip-browser-warning": "69420",
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setRoutes(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("노선 불러오기 실패:", error);
        setRoutes([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRoutes();
  }, []);

  useEffect(() => {
    localStorage.setItem("bus-favorites", JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (id: number) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((favId) => favId !== id) : [...prev, id],
    );
  };

  const handleRouteClick = (routeId: number) => {
    navigate(`/ticket/${routeId}`);
  };

  const filteredRoutes = (routes || []).filter(
    (route) =>
      route.route_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.location?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="pt-14 px-6 pb-6 bg-white sticky top-0 z-10 border-b border-gray-50">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4">
          셔틀 버스
        </h1>
        <div className="relative">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="노선 또는 정거장 검색"
            className="w-full bg-gray-100 py-3.5 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="pb-24">
        {isLoading ? (
          <div className="py-20 text-center text-gray-400 animate-pulse font-medium">
            노선 정보를 불러오는 중입니다...
          </div>
        ) : (
          <>
            {favorites.length > 0 && routes.length > 0 && (
              <div className="mb-6">
                <div className="px-6 py-3 text-[11px] font-bold text-blue-500 uppercase tracking-widest">
                  ⭐ 즐겨찾는 노선
                </div>
                {routes
                  .filter((r) => favorites.includes(r.id))
                  .map((route) => (
                    <RouteItem
                      key={`fav-${route.id}`}
                      name={route.route_name}
                      time={route.time || "수시운행"}
                      isFavorite={true}
                      onToggle={() => toggleFavorite(route.id)}
                      onClick={() => handleRouteClick(route.id)}
                    />
                  ))}
              </div>
            )}

            <div className="px-6 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              전체 노선
            </div>
            {filteredRoutes.length > 0 ? (
              filteredRoutes.map((route) => (
                <RouteItem
                  key={route.id}
                  name={route.route_name}
                  time={route.time || "수시운행"}
                  isFavorite={favorites.includes(route.id)}
                  onToggle={() => toggleFavorite(route.id)}
                  onClick={() => handleRouteClick(route.id)}
                />
              ))
            ) : (
              <div className="py-20 text-center text-gray-400">
                {searchTerm
                  ? "검색 결과가 없습니다."
                  : "운행 중인 노선이 없습니다."}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
