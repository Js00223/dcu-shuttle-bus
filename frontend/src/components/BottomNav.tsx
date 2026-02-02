import { Home, MapPin, Wallet, Mail, User, ScanText } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export const BottomNav = () => {
  const location = useLocation();

  const navItems = [
    { icon: Home, label: "홈", path: "/" },
    { icon: MapPin, label: "위치", path: "/track" },
    { icon: ScanText, label: "학생증", path: "/nfc-scan" }, // 학생증 스캔 버튼
    { icon: Mail, label: "쪽지", path: "/messages" },
    { icon: Wallet, label: "포인트", path: "/points" },
    { icon: User, label: "마이", path: "/mypage" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 pb-safe z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-20 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
                isActive ? "text-blue-600 scale-110" : "text-gray-400"
              }`}
            >
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span
                className={`text-[8px] font-bold tracking-tighter ${
                  isActive ? "opacity-100" : "opacity-70"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
