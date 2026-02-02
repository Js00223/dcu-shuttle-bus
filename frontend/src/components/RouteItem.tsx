// src/components/RouteItem.tsx

interface RouteProps {
  name: string;
  time: string;
  isFavorite: boolean;
  onToggle: () => void;
  onClick: () => void; // 예약 팝업을 띄우기 위한 클릭 이벤트 추가
}

export const RouteItem = ({
  name,
  time,
  isFavorite,
  onToggle,
  onClick,
}: RouteProps) => {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-5 bg-white border-b border-gray-100 active:bg-gray-50 transition-colors cursor-pointer"
    >
      <div className="flex flex-col gap-1">
        <span className="text-[17px] font-semibold text-gray-800 leading-tight">
          {name}
        </span>
        <span className="text-sm text-blue-500 font-bold bg-blue-50 px-2 py-0.5 rounded-md w-fit">
          {time}
        </span>
      </div>

      {/* Apple Style Toggle Switch */}
      <label
        className="relative inline-flex items-center cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isFavorite}
          onChange={onToggle}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#34C759]"></div>
      </label>
    </div>
  );
};
