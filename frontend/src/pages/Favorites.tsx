import { useState, useEffect, useCallback } from "react";
import axios from "axios";

interface BusRoute {
  id: number;
  routeName: string;
  nextBus: string;
  isFavorite: boolean;
}

export const Favorites = () => {
  const [favorites, setFavorites] = useState<BusRoute[]>([]);
  const [loading, setLoading] = useState(true);

  // [기능] 서버로부터 즐겨찾기 목록 가져오기
  const fetchFavorites = useCallback(async () => {
    // App.tsx에서 사용하는 키값 'token'과 일치시킵니다.
    const token = localStorage.getItem("token");

    if (!token) {
      console.error("인증 토큰이 없습니다. 로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get("/api/user/favorites", {
        headers: { Authorization: `Bearer ${token}` },
      });

      // 서버 응답이 배열인지 검증 (에러 방지 핵심)
      if (Array.isArray(response.data)) {
        setFavorites(response.data);
      } else {
        console.warn("데이터 형식이 배열이 아닙니다:", response.data);
        setFavorites([]);
      }
    } catch (error) {
      console.error("즐겨찾기 로드 실패:", error);
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // [기능] 토글 스위치 상태 변경 (서버 DB 동기화)
  const handleToggleFavorite = async (
    routeId: number,
    currentStatus: boolean,
  ) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      // 1. 낙관적 업데이트: 서버 응답 전 화면 스위치를 먼저 변경
      setFavorites((prev) =>
        prev.map((route) =>
          route.id === routeId
            ? { ...route, isFavorite: !currentStatus }
            : route,
        ),
      );

      // 2. 서버 DB에 상태 저장
      await axios.post(
        `/api/user/favorites/toggle`,
        { routeId, status: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (error) {
      console.error("토글 저장 실패:", error);
      alert("연결이 원활하지 않아 상태를 변경하지 못했습니다.");
      // 실패 시 서버 데이터로 다시 롤백
      fetchFavorites();
    }
  };

  if (loading)
    return (
      <div className="p-6 text-center animate-pulse text-gray-400 font-bold">
        데이터 동기화 중...
      </div>
    );

  return (
    <div className="p-6 pb-32">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-gray-900">노선 즐겨찾기</h1>
        <button
          onClick={fetchFavorites}
          className="text-xs text-blue-500 font-bold p-2 active:opacity-50"
        >
          새로고침 ↻
        </button>
      </div>

      {favorites.length > 0 ? (
        <div className="space-y-4">
          {favorites.map((route) => (
            <div
              key={route.id}
              className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex justify-between items-center"
            >
              <div>
                <p className="font-black text-lg text-gray-800">
                  {route.routeName}
                </p>
                <p className="text-sm text-blue-500 font-bold mt-1">
                  {route.nextBus}
                </p>
              </div>

              {/* 토글 스위치 UI */}
              <button
                onClick={() => handleToggleFavorite(route.id, route.isFavorite)}
                className={`w-14 h-8 flex items-center rounded-full p-1 transition-all duration-300 ${
                  route.isFavorite ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <div
                  className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${
                    route.isFavorite ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-[2rem] border border-dashed border-gray-200">
          <p className="text-gray-400 font-bold tracking-tight">
            표시할 즐겨찾기가 없습니다.
            <br />
            <span className="text-[10px] font-medium italic">
              다른 브라우저에서 스위치를 켜면 여기에 나타납니다.
            </span>
          </p>
        </div>
      )}
    </div>
  );
};
