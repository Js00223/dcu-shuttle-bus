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

  // 즐겨찾기 상태
  const [favorites, setFavorites] = useState<number[]>([]);

  // [기능 1] 노선 데이터 및 사용자 즐겨찾기 불러오기
  const fetchData = useCallback(async () => {
    if (isFetching.current) return;

    try {
      isFetching.current = true;
      setIsLoading(true);

      // 1. 전체 노선 정보 가져오기
      const routesResponse = await api.get("/routes", {
        params: { t: Date.now() }
      });
      
      if (Array.isArray(routesResponse.data)) {
        setRoutes(routesResponse.data);
      }

      // 2. 로그인된 유저의 최신 즐겨찾기 상태 가져오기
      const rawUserId = localStorage.getItem("user_id");
      if (rawUserId && rawUserId !== "undefined" && rawUserId !== "null") {
        const userId = parseInt(rawUserId);
        const userStatusResponse = await api.get(`/user/status?user_id=${userId}`);
        if (userStatusResponse.data && userStatusResponse.data.favorites) {
          setFavorites(userStatusResponse.data.favorites);
          localStorage.setItem("bus-favorites", JSON.stringify(userStatusResponse.data.favorites));
        }
      }
    } catch (error: any) {
      if (error.code !== 'ERR_CANCELED') {
        console.error("데이터 불러오기 실패:", error);
      }
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // [기능 2] 즐겨찾기 토글 (서버 DB와 연동)
  const toggleFavorite = async (routeId: number) => {
    // localStorage에서 값을 가져온 뒤 철저히 검사
    const rawUserId = localStorage.getItem("user_id");
    
    // 유효성 검사: 값이 없거나, 문자열 "null"/"undefined"인 경우 차단
    if (!rawUserId || rawUserId === "null" || rawUserId === "undefined") {
      console.error("로그인 세션 없음:", rawUserId);
      alert("로그인이 필요한 기능입니다. 다시 로그인해주세요.");
      navigate("/login"); // 로그인 페이지로 유도
      return;
    }

    const userId = parseInt(rawUserId);

    try {
      // 서버 API 호출
      const response = await api.post("/user/toggle-favorite", {
        user_id: userId,
        route_id: routeId
      });

      if (response.data && response.data.favorites) {
        setFavorites(response.data.favorites);
        localStorage.setItem("bus-favorites", JSON.stringify(response.data.favorites));
      }
    } catch (error) {
      console.error("즐겨찾기 업데이트 실패:", error);
      alert("즐겨찾기 반영 중 오류가 발생했습니다.");
    }
  };

  const handleRouteClick = (routeId: number) => {
    navigate(`/ticket/${routeId}`);
  };

  // 검색 필터링 로직
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
