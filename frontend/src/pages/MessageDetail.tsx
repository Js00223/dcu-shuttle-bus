import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Trash2, Clock, User } from "lucide-react";
import axios from "axios";

interface MessageDetail {
  id: number;
  title: string;
  content: string;
  sender_id: number;
  created_at: string;
}

const BACKEND_URL = "https://dcu-shuttle-bus.onrender.com";

export const MessageDetail = () => {
  const { id } = useParams(); // URL에서 message_id 추출
  const navigate = useNavigate();
  const [msg, setMsg] = useState<MessageDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        // 상세 정보 조회 (백엔드에서 이 API 호출 시 읽음 처리 로직이 실행됨)
        const response = await axios.get<MessageDetail>(`${BACKEND_URL}/api/messages/${id}`);
        setMsg(response.data);
      } catch (err) {
        console.error("쪽지 상세 로드 실패:", err);
        alert("쪽지를 불러올 수 없습니다.");
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchDetail();
  }, [id, navigate]);

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="animate-pulse text-gray-400 font-medium">내용을 읽어오는 중...</div>
    </div>
  );

  if (!msg) return null;

  return (
    <div className="min-h-screen bg-white font-pretendard">
      {/* 상단 네비게이션 바 */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white/80 backdrop-blur-md flex items-center justify-between px-4 border-b border-gray-50 z-10">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft size={24} className="text-gray-900" />
        </button>
        <h2 className="text-[17px] font-bold text-gray-900">쪽지 읽기</h2>
        <button className="p-2 text-red-500 opacity-0 pointer-events-none">
          <Trash2 size={20} />
        </button>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="pt-20 px-6 pb-10">
        {/* 제목 섹션 */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900 leading-tight mb-4">
            {msg.title}
          </h1>
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center text-gray-500 gap-2">
              <User size={14} className="text-blue-500" />
              <span className="text-sm font-semibold">보낸이: 관리자</span>
            </div>
            <div className="flex items-center text-gray-400 gap-2">
              <Clock size={14} />
              <span className="text-xs">
                {new Date(msg.created_at).toLocaleString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        </div>

        {/* 구분선 */}
        <div className="h-[1px] bg-gray-100 w-full mb-8" />

        {/* 본문 섹션 */}
        <div className="text-[16px] leading-[1.6] text-gray-800 whitespace-pre-wrap min-h-[300px]">
          {msg.content}
        </div>

        {/* 하단 버튼 */}
        <div className="mt-12">
          <button
            onClick={() => navigate(-1)}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-[16px] active:scale-[0.98] transition-all shadow-lg"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
