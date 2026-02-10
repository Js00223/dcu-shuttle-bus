// src/components/EtaFloatingBar.tsx
import React from 'react';

interface EtaProps {
  busName: string;
  stationName: string;
  duration: number; // 분 단위
  distance: number; // km 단위
}

const EtaFloatingBar: React.FC<EtaProps> = ({ busName, stationName, duration, distance }) => {
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[50] w-[90%] max-w-md animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-white/70 backdrop-blur-md border border-white/50 p-4 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            🚌
          </div>
          <div>
            <p className="text-[10px] font-bold text-blue-600 tracking-tighter uppercase">Real-time Arrival</p>
            <p className="text-sm font-bold text-gray-800">
              {busName} → <span className="text-blue-600">{stationName}</span>
            </p>
          </div>
        </div>
        <div className="text-right border-l pl-4 border-gray-200">
          <p className="text-2xl font-black text-blue-600 tabular-nums">
            {duration <= 1 ? "곧 도착" : `${duration}분`}
          </p>
          <p className="text-[10px] text-gray-400 font-medium">{distance}km 남음</p>
        </div>
      </div>
    </div>
  );
};

export default EtaFloatingBar;
