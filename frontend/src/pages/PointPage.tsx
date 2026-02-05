import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api"; 

// ✅ 사용하지 않는 interface IMP 삭제 (에러 TS6196 해결)

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

// ✅ 타입 충돌 방지를 위해 window.IMP를 any로 인식하도록 처리
declare global {
  interface Window {
    IMP: any;
  }
}

const CHARGE_FEE = 330;

export const PointPage = () => {
  const navigate = useNavigate();
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const SERVER_URL = "https://dcu-shuttle-bus.onrender.com/api";

  const fetchPoints = useCallback(async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      if (!userId) {
        navigate("/login");
        return;
      }

      const response = await api.get(`${SERVER_URL}/user/status`, {
        params: { user_id: userId }
      }); 
      
      if (response.data) {
        setPoints(response.data.points || 0);
        localStorage.setItem("user", JSON.stringify(response.data));
      }
    } catch (error: any) {
      console.error("데이터 동기화 실패:", error);
      const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
      setPoints(savedUser.points || 0);
    } finally {
      setLoading(false);
    }
  }, [navigate, SERVER_URL]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  const handlePayment = useCallback(
    (amount: number) => {
      // ✅ window에서 IMP를 가져올 때 any 타입으로 처리되어 충돌이 없습니다.
      const { IMP } = window;
      if (!IMP) {
        alert("결제 모듈 로드 실패");
        return;
      }

      IMP.init("imp75854740");
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      const paymentData: PaymentData = {
        pg: "kcp.IP06C", 
        pay_method: "vbank", 
        merchant_uid: `mid_${new Date().getTime()}`,
        amount: amount + CHARGE_FEE,
        name: `${amount.toLocaleString()} 포인트 충전`,
        buyer_name: user.name || "사용자", 
        buyer_tel: "010-0000-0000",
      };

      IMP.request_pay(paymentData, async (rsp: IMPResponse) => {
        if (rsp.success) {
          try {
            const response = await api.post(`${SERVER_URL}/charge/request`, null, {
              params: { 
                user_id: userId,
                amount: amount 
              }
            });

            if (response.status === 200) {
              alert(`가상계좌 발급 성공: ${rsp.vbank_name} ${rsp.vbank_num}`);
              fetchPoints(); 
            }
          } catch (serverError: any) {
            console.error("충전 에러:", serverError);
          }
        } else {
          alert(`실패: ${rsp.error_msg}`);
        }
      });
    },
    [fetchPoints, SERVER_URL],
  );

  if (loading) return <div className="flex items-center justify-center min-h-screen">로딩중...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen flex flex-col items-center font-pretendard">
      <div className="w-full max-w-md bg-blue-600 rounded-[2.5rem] p-8 text-white shadow-xl mb-8">
        <p className="text-xs opacity-70 mb-1 font-bold">나의 잔여 포인트</p>
        <h1 className="text-4xl font-black">{points.toLocaleString()} P</h1>
      </div>

      <div className="w-full max-w-md space-y-3">
        <h3 className="font-bold text-gray-700 px-2 mb-2">포인트 충전</h3>
        {[10000, 30000, 50000].map((amt) => (
          <button
            key={amt}
            onClick={() => handlePayment(amt)}
            className="w-full py-5 bg-white border border-gray-100 rounded-2xl font-bold shadow-sm flex justify-between px-6 items-center hover:bg-blue-50 active:scale-[0.98] transition-all"
          >
            <div className="flex flex-col items-start">
              <span className="text-gray-900">{(amt + CHARGE_FEE).toLocaleString()}원</span>
              <span className="text-[10px] text-gray-400 font-medium tracking-tight">가상계좌 수수료 포함</span>
            </div>
            <span className="text-blue-600 font-bold">+{amt.toLocaleString()}P</span>
          </button>
        ))}
      </div>

      <button onClick={() => navigate("/")} className="mt-10 text-gray-400 font-bold text-sm underline underline-offset-4">
        홈으로 돌아가기
      </button>
    </div>
  );
};
