import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api"; // ✅ 아까 만든 api 인스턴스 사용

// 결제 요청 데이터 타입 정의
interface PaymentData {
  pg: string;
  pay_method: string;
  merchant_uid: string;
  amount: number;
  name: string;
  buyer_name: string;
  buyer_tel: string;
}

interface IMPResponse {
  success: boolean;
  vbank_name?: string;
  vbank_num?: string;
  error_msg?: string;
}

interface IMP {
  init: (accountCode: string) => void;
  request_pay: (
    data: PaymentData,
    callback: (rsp: IMPResponse) => void,
  ) => void;
}

declare global {
  interface Window {
    IMP?: IMP;
  }
}

const CHARGE_FEE = 330;

export const PointPage = () => {
  const navigate = useNavigate();
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // 서버로부터 포인트 데이터 가져오기
  const fetchPoints = useCallback(async () => {
    try {
      setLoading(true);
      // ✅ axios 대신 api 인스턴스 사용 (Authorization 헤더 자동 포함)
      const response = await api.get("/api/auth/me"); 
      setPoints(response.data.points);
    } catch (error) {
      console.error("포인트 로딩 실패:", error);
      // 서버 에러 시 로컬 스토리지에 저장된 유저 정보에서 가져옴
      const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
      setPoints(savedUser.points || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  const handlePayment = useCallback(
    (amount: number) => {
      const { IMP } = window;
      if (!IMP) {
        alert("결제 모듈을 불러올 수 없습니다. 다시 시도해주세요.");
        return;
      }

      IMP.init("imp75854740");

      const totalWithFee = amount + CHARGE_FEE;
      const orderId = `mid_${new Date().getTime()}`;
      
      // 로컬 스토리지에서 유저 정보 가져오기
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      const paymentData: PaymentData = {
        pg: "kcp.IP06C",
        pay_method: "vbank", // 필요시 'card'나 'kakaopay'로 변경 가능
        merchant_uid: orderId,
        amount: totalWithFee,
        name: `${amount.toLocaleString()} 포인트 충전`,
        buyer_name: user.name || "사용자",
        buyer_tel: "010-0000-0000", // 실제 정보가 있다면 연동
      };

      IMP.request_pay(paymentData, async (rsp: IMPResponse) => {
        if (rsp.success) {
          try {
            // ✅ 서버에 충전 내역 전송 (쿼리 파라미터 혹은 바디 확인 필요)
            const response = await api.post("/api/points/charge", null, {
              params: { amount: amount }
            });

            if (response.status === 200) {
              alert(
                `충전 신청 성공!\n은행: ${rsp.vbank_name}\n계좌: ${rsp.vbank_num}\n입금 시 포인트가 즉시 반영됩니다.`
              );
              
              // 로컬 스토리지 유저 정보 업데이트
              user.points = response.data.points;
              localStorage.setItem("user", JSON.stringify(user));
              
              fetchPoints(); // 성공 후 화면 포인트 갱신
            }
          } catch (serverError) {
            console.error("서버 반영 실패:", serverError);
            alert("결제는 성공했으나 서버 반영에 실패했습니다.");
          }
        } else {
          alert(`결제 실패: ${rsp.error_msg}`);
        }
      });
    },
    [fetchPoints],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen pb-32 flex flex-col items-center font-pretendard">
      <div className="w-full max-w-md bg-blue-600 rounded-[2.5rem] p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-xs opacity-70 mb-1 font-bold">나의 잔여 포인트</p>
          <h1 className="text-4xl font-black">{points.toLocaleString()} P</h1>
        </div>
        {/* 장식용 원형 디자인 */}
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white opacity-10 rounded-full"></div>
      </div>

      <div className="w-full max-w-md space-y-3">
        <h3 className="font-bold text-gray-700 px-2 mb-2">포인트 충전</h3>
        {[10000, 30000, 50000].map((amt) => (
          <button
            key={amt}
            onClick={() => handlePayment(amt)}
            className="w-full py-5 bg-white border border-gray-100 rounded-2xl font-bold shadow-sm flex justify-between px-6 items-center active:scale-[0.98] transition-all"
          >
            <div className="flex flex-col items-start">
              <span className="text-gray-900">
                {(amt + CHARGE_FEE).toLocaleString()}원
              </span>
              <span className="text-[10px] text-gray-400 font-medium tracking-tight">
                가상계좌 수수료 포함
              </span>
            </div>
            <span className="text-blue-600">+{amt.toLocaleString()}P</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => navigate("/")}
        className="mt-10 text-gray-400 font-bold text-sm underline underline-offset-4"
      >
        홈으로 돌아가기
      </button>

      <p className="mt-8 text-[11px] text-gray-400 text-center leading-relaxed font-medium">
        충전 내역은 서버에 동기화되어
        <br />
        어디서든 동일하게 확인 가능합니다.
      </p>
    </div>
  );
};
