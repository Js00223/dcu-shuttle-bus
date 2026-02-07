import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { RouteItem } from "../components/RouteItem";
import { Search } from "lucide-react";
import api from "../utils/api"; 

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
  
  // 중복 요청 방지용 Ref
  const isFetching = useRef(false);

  // 즐겨찾기 상태 (로컬 스토리지 연동)
  const [favorites, setFavorites] = useState<number[]>(() => {
    const saved = localStorage.getItem("bus-favorites");
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // [기능 1] 노선 데이터 불러오기
  const fetchRoutes = useCallback(async () => {
    if (isFetching.current) return;

    try {
      isFetching.current = true;
      setIsLoading(true);

      const response = await api.get("/routes", {
        params: { t: Date.now() } // 실시간성 확보 및 캐시 방지
      });

      if (Array.isArray(response.data)) {
        setRoutes(response.data);
      } else {
        setRoutes([]);
      }
    } catch (error: any) {
      if (error.code !== 'ERR_CANCELED') {
        console.error("노선 불러오기 실패:", error);
      }
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  // [기능 2] 즐겨찾기 변경 시 로컬 스토리지 저장
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

  // 검색 필터링 로직 (routes가 비어있을 경우 대비)
  const filteredRoutes = (routes || []).filter(
    (route) =>
      route.route_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.location?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-white">
      {/* 검색 헤더 */}
      <div className="pt-14 px-6 pb-6 bg-white sticky top-0 z-10 border-b border-gray-50">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4">셔틀 버스</h1>
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
            {/* ⭐ 즐겨찾는 노선 섹션 */}
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

            {/* 🚌 전체 노선 섹션 */}
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
