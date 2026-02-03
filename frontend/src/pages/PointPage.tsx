import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api"; 

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

  // [기능 1] 서버로부터 포인트 데이터 가져오기
  const fetchPoints = useCallback(async () => {
    try {
      setLoading(true);
      
      // 1. 로컬스토리지에서 유저 정보를 가져와 userId 정의
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      if (!userId) {
        console.warn("로그인 정보가 없습니다.");
        navigate("/login");
        return;
      }

      // 2. 서버 엔드포인트 호출 (main.py의 @app.get("/api/user/status")와 일치)
      // 만약 api.ts의 baseURL에 /api가 없다면 아래처럼 "/user/status"로 적어야 합니다.
      const response = await api.get("/api/user/status", {
        params: { user_id: userId }
      }); 
      
      if (response.data) {
        setPoints(response.data.points || 0);
        // 최신 정보를 로컬에도 저장
        localStorage.setItem("user", JSON.stringify(response.data));
      }
    } catch (error: any) {
      console.error("포인트 로딩 실패:", error);
      const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
      setPoints(savedUser.points || 0);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  // [기능 2] 결제 핸들러
  const handlePayment = useCallback(
    (amount: number) => {
      const { IMP } = window;
      if (!IMP) {
        alert("결제 모듈이 로드되지 않았습니다. 페이지를 새로고침 해주세요.");
        return;
      }

      IMP.init("imp75854740");

      const totalWithFee = amount + CHARGE_FEE;
      const orderId = `mid_${new Date().getTime()}`;
      
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      const paymentData: PaymentData = {
        pg: "kcp.IP06C", 
        pay_method: "vbank", 
        merchant_uid: orderId,
        amount: totalWithFee,
        name: `${amount.toLocaleString()} 포인트 충전`,
        buyer_name: user.name || "사용자", 
        buyer_tel: "010-0000-0000",
      };

      IMP.request_pay(paymentData, async (rsp: IMPResponse) => {
        if (rsp.success) {
          try {
            // ✅ 서버 main.py의 @app.post("/api/charge/request")와 일치
            const response = await api.post("/charge/request", null, {
              params: { 
                user_id: userId,
                amount: amount 
              }
            });

            if (response.status === 200) {
              alert(
                `가상계좌 발급 성공!\n은행: ${rsp.vbank_name}\n계좌: ${rsp.vbank_num}`
              );
              fetchPoints(); 
            }
          } catch (serverError: any) {
            console.error("충전 요청 에러:", serverError);
            alert("서버 등록에 실패했습니다.");
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
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white opacity-10 rounded-full"></div>
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
              <span className="text-[10px] text-gray-400 font-medium">가상계좌 수수료 포함</span>
            </div>
            <span className="text-blue-600">+{amt.toLocaleString()}P</span>
          </button>
        ))}
      </div>

      <button onClick={() => navigate("/")} className="mt-10 text-gray-400 font-bold text-sm underline">
        홈으로 돌아가기
      </button>
    </div>
  );
};
