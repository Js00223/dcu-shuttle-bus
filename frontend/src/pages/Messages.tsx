import { useState } from "react";
import { ChevronRight, MailOpen, Mail } from "lucide-react";

// 타입 정의
interface Message {
  id: number;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

// 초기 더미 데이터: useEffect를 사용하지 않고 초기 State로 할당하기 위해 컴포넌트 외부로 분리
const INITIAL_MESSAGES: Message[] = [
  {
    id: 1,
    title: "포인트 충전 완료",
    content: "요청하신 10,000P 충전이 완료되었습니다. 이용해주셔서 감사합니다.",
    is_read: false,
    created_at: "방금 전",
  },
  {
    id: 2,
    title: "학기권 승인 안내",
    content:
      "구미 노선 시외 학기권 신청이 승인되었습니다. 오늘부터 사용 가능합니다.",
    is_read: true,
    created_at: "2시간 전",
  },
];

export const Messages = () => {
  // useEffect 없이 직접 초기값을 전달하여 Cascading Render 에러 해결
  const [messages] = useState<Message[]>(INITIAL_MESSAGES);

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
                    {msg.created_at}
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
