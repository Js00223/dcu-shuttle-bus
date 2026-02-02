import { useState, useCallback } from "react";

// 1. Web NFC 전용 타입 정의
interface NDEFReadingEvent extends Event {
  serialNumber: string;
}

// 2. 리스너 타입을 구체적으로 정의하여 any 제거
type NDEFReadingListener = (event: NDEFReadingEvent) => void;

interface NDEFReader {
  scan: () => Promise<void>;
  addEventListener(type: "reading", listener: NDEFReadingListener): void;
}

interface NFCWindow extends Window {
  NDEFReader?: {
    new (): NDEFReader;
  };
}

export const NfcScanPage = () => {
  const [status, setStatus] = useState<"idle" | "scanning" | "success">("idle");
  const [scannedId, setScannedId] = useState<string>("");

  const startScan = useCallback(async () => {
    const nfcWindow = window as unknown as NFCWindow;

    if (!nfcWindow.NDEFReader) {
      alert("NFC 기능을 지원하지 않는 환경입니다. (안드로이드 크롬 권장)");
      return;
    }

    try {
      setStatus("scanning");
      const Reader = nfcWindow.NDEFReader;
      const ndef = new Reader();
      await ndef.scan();

      // 3. 타입 안정성 확보
      ndef.addEventListener("reading", (event: NDEFReadingEvent) => {
        setScannedId(event.serialNumber);
        setStatus("success");
        if (navigator.vibrate) navigator.vibrate(200);
      });
    } catch (error) {
      console.error("NFC Error:", error);
      setStatus("idle");
      alert("NFC 스캔을 시작할 수 없습니다.");
    }
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 pb-32">
      <div className="text-center mb-10">
        <h1 className="text-2xl font-black text-gray-900">
          디지털 학생증 스캔
        </h1>
        <p className="text-gray-400 text-sm mt-2 font-medium">
          단말기 뒷면에 카드를 접촉하세요
        </p>
      </div>

      {/* 인식 상태 시각화 */}
      <div
        className={`w-64 h-64 rounded-full border-[10px] flex items-center justify-center transition-all duration-700 ${
          status === "scanning"
            ? "border-blue-500 animate-pulse scale-105 shadow-[0_0_30px_rgba(59,130,246,0.3)]"
            : status === "success"
              ? "border-green-500 bg-green-50 shadow-[0_0_30px_rgba(34,197,94,0.2)]"
              : "border-gray-100"
        }`}
      >
        <span className="text-7xl">{status === "success" ? "✅" : "💳"}</span>
      </div>

      <div className="mt-12 w-full max-w-xs space-y-4">
        {status === "success" && (
          <div className="p-5 bg-gray-50 rounded-2xl text-center border border-gray-100">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              Authorized Serial
            </p>
            <p className="text-xl font-black text-blue-600 tracking-tight">
              {scannedId}
            </p>
          </div>
        )}
        <button
          onClick={startScan}
          disabled={status === "scanning"}
          className={`w-full py-5 rounded-[1.5rem] font-black text-lg shadow-xl transition-all active:scale-95 ${
            status === "scanning"
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-blue-600 text-white"
          }`}
        >
          {status === "scanning" ? "인식 중..." : "학생증 스캔 시작"}
        </button>
      </div>
    </div>
  );
};
