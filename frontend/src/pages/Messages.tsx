import { useState, useEffect, useCallback } from "react";
import { ChevronRight, MailOpen, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

// 타입 정의
interface Message {
  id: number;
  title: string;
  content: string;
  is_read: number; // 백엔드에서 0 또는 1로 관리하므로 number로 변경
  created_at: string;
}

const BACKEND_URL = "https://dcu-shuttle-bus.onrender.com";

export const Messages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  // ✅ 쪽지 목록 가져오기 함수
  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      if (!userId) {
        console.error("로그인이 필요합니다.");
        return;
      }

      const response = await axios.get<Message[]>(`${BACKEND_URL}/api/messages`, {
        params: { user_id: userId }
      });

      if (response.data) {
        setMessages(response.data);
      }
    } catch (err) {
      console.error("쪽지 목록 로드 실패:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // ✅ 시간 포맷팅 함수 (ISO 형식을 읽기 좋게)
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">쪽지함을 확인하고 있습니다...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] pt-12 pb-20">
      {/* 헤더 섹션 */}
      <div className="px-6 mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          쪽지함
        </h1>
      </div>

      {/* 리스트 섹션: Apple Style Card Layout */}
      <div className="mx-4 bg-white rounded-[2rem] overflow-hidden shadow-sm border border-gray-100">
        {messages.length > 0 ? (
          messages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => navigate(`/messages/${msg.id}`)} // ✅ 상세 페이지 이동 추가
              className="flex items-center p-5 border-b border-gray-50 last:border-0 active:bg-gray-50 transition-colors cursor-pointer"
            >
              {/* 읽음 여부에 따른 아이콘 표시 */}
              <div
                className={`mr-4 p-3 rounded-2xl ${msg.is_read ? "bg-gray-100 text-gray-400" : "bg-blue-100 text-blue-600"}`}
              >
                {msg.is_read ? <MailOpen size={20} /> : <Mail size={20} />}
              </div>

              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  {/* 읽지 않은 메시지는 텍스트를 굵게 표시 */}
                  <h3
                    className={`text-[16px] ${msg.is_read ? "text-gray-500" : "font-bold text-gray-900"}`}
                  >
                    {msg.title}
                  </h3>
                  <span className="text-[11px] text-gray-400">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
                {/* 긴 내용은 한 줄로 줄임표 처리 */}
                <p className="text-sm text-gray-400 line-clamp-1">
                  {msg.content}
                </p>
              </div>

              {/* 상세 보기 화살표 아이콘 */}
              <ChevronRight size={18} className="text-gray-300 ml-2" />
            </div>
          ))
        ) : (
          /* 메시지가 없을 때의 UI */
          <div className="py-20 text-center">
            <p className="text-gray-400">받은 쪽지가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};
