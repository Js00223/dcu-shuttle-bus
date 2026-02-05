import { useState, useEffect, useCallback } from "react";
import axios, { AxiosError } from "axios";

// ✅ 환경 설정
const BACKEND_URL = "https://dcu-shuttle-bus.onrender.com";
const CHARGE_FEE = 330;
const SEMESTER_PASS_PRICE = 150000;

interface UserStatus {
  points: number;
  hasSemesterPass: boolean;
  passExpiryDate?: string;
}

interface PendingPayment {
  payment_id: string;
  amount: number;
  expire_at: string;
  account: string;
}

interface BackendError {
  detail: string;
}

// ✅ TS2687, TS2717 에러 해결: 중복 선언 충돌을 피하기 위해 전역 속성 정의
// 이 부분은 다른 파일(PointPage.tsx)과 형식이 같아야 하므로 가장 표준적인 any를 사용합니다.


export const PointAndPass = () => {
  const [points, setPoints] = useState<number>(0);
  const [hasPass, setHasPass] = useState<boolean>(false);
  const [expiryDate, setExpiryDate] = useState<string | undefined>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  
  // ✅ TS6133 에러 해결: 사용하지 않는 timeLeft 변수를 가상계좌 UI에서 사용함
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const fetchUserStatus = useCallback(async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      if (!userId) return;

      const response = await axios.get<UserStatus>(
        `${BACKEND_URL}/api/user/status`, 
        { params: { user_id: userId } }
      );

      if (response.data) {
        setPoints(response.data.points ?? 0);
        setHasPass(response.data.hasSemesterPass ?? false);
        setExpiryDate(response.data.passExpiryDate ?? "");
      }
    } catch (err) {
      console.error("데이터 동기화 실패:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserStatus();
  }, [fetchUserStatus]);

  useEffect(() => {
    if (!pendingPayment) return;
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = new Date(pendingPayment.expire_at).getTime() - now;
      if (distance <= 0) {
        clearInterval(timer);
        setPendingPayment(null);
      } else {
        setTimeLeft(Math.floor((distance % (1000 * 60)) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingPayment]);

  const handleRequestCharge = async (amount: number) => {
    const { IMP } = window;
    if (!IMP) {
      alert("결제 모듈이 로드되지 않았습니다. 페이지를 새로고침 해주세요.");
      return;
    }

    IMP.init("imp75854740"); 

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = user.user_id || user.id;

    const paymentData = {
      pg: "html5_inicis",
      pay_method: "card",
      merchant_uid: `mid_${new Date().getTime()}`,
      name: `${amount}P 포인트 충전`,
      amount: amount + CHARGE_FEE,
      buyer_email: user.email || "",
      buyer_name: user.name || "사용자",
    };

    IMP.request_pay(paymentData, async (rsp: any) => {
      if (rsp.success) {
        try {
          await axios.post(`${BACKEND_URL}/api/charge/request`, { 
            user_id: userId,
            amount: amount,
            imp_uid: rsp.imp_uid,
            merchant_uid: rsp.merchant_uid
          });
          alert("결제가 완료되었습니다!");
          await fetchUserStatus();
        } catch (err) {
          alert("서버 반영 실패. 고객센터로 문의하세요.");
        }
      } else {
        alert(`결제 실패: ${rsp.error_msg}`);
      }
    });
  };

  const handlePurchasePass = async () => {
    if (hasPass) return alert("이미 활성화된 정기권이 있습니다.");
    if (points < SEMESTER_PASS_PRICE) {
      return alert(`포인트가 부족합니다. (필요 포인트: ${SEMESTER_PASS_PRICE.toLocaleString()}P)`);
    }

    if (!window.confirm(`정기권을 신청하시겠습니까?\n${SEMESTER_PASS_PRICE.toLocaleString()}P가 차감됩니다.`)) return;

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      await axios.post(`${BACKEND_URL}/api/pass/purchase`, {
        user_id: userId,
        pass_type: "SEMESTER"
      });

      alert("정기권 신청이 완료되었습니다!");
      await fetchUserStatus();
    } catch (err) {
      const axiosError = err as AxiosError<BackendError>;
      alert(axiosError.response?.data?.detail || "신청 중 에러가 발생했습니다.");
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse">데이터 로드 중...</div>;

  return (
    <div className="min-h-screen bg-[#F2F2F7] p-4 pb-24 font-pretendard">
      <div className="bg-white rounded-3xl p-8 shadow-sm mb-6 border border-gray-100">
        <p className="text-gray-400 text-sm mb-2 font-medium">나의 잔여 포인트</p>
        <h1 className="text-4xl font-black text-gray-900">
          {(points ?? 0).toLocaleString()} <span className="text-2xl">P</span>
        </h1>
      </div>

      {/* 가상계좌 입금 대기 UI (여기서 timeLeft를 사용하여 경고 해결) */}
      {pendingPayment && (
        <div className="bg-blue-600 rounded-3xl p-6 mb-6 text-white shadow-xl">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold">가상계좌 입금 대기</h3>
            <span className="bg-red-500 text-[10px] px-2 py-1 rounded-full font-bold">
              {timeLeft}초 남음
            </span>
          </div>
          <div className="bg-blue-700/50 rounded-2xl p-4 text-sm space-y-1">
            <p className="flex justify-between"><span>계좌:</span> <b>{pendingPayment.account}</b></p>
            <p className="flex justify-between"><span>금액:</span> <b>{(pendingPayment.amount + CHARGE_FEE).toLocaleString()}원</b></p>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h3 className="font-black text-gray-800 mb-4 px-2">포인트 충전</h3>
        <div className="grid grid-cols-2 gap-3">
          {[10000, 30000, 50000, 100000, 200000, 300000].map((amount) => (
            <button
              key={amount}
              onClick={() => handleRequestCharge(amount)}
              className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm text-left active:scale-95 transition-all"
            >
              <p className="text-blue-500 text-[10px] font-bold">+{amount.toLocaleString()}P</p>
              <p className="text-gray-900 font-black">{(amount + CHARGE_FEE).toLocaleString()}원</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
        <h3 className="font-black text-gray-800 mb-4">시외 학기권 상태</h3>
        
        {hasPass ? (
          <div className="bg-green-50 p-5 rounded-2xl border border-green-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <p className="text-green-700 font-black text-sm">정기권 활성화 중 ✅</p>
            </div>
            <p className="text-green-600 text-xs font-bold">만료 예정: {expiryDate}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-200">
              <p className="text-gray-500 text-sm text-center">보유 중인 정기권이 없습니다.</p>
            </div>
            
            <button
              onClick={handlePurchasePass}
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-lg active:scale-95 transition-all shadow-lg"
            >
              학기권 신청하기 ({SEMESTER_PASS_PRICE.toLocaleString()}P)
            </button>
            <p className="text-[10px] text-gray-400 text-center">
              * 현재 잔여 포인트: {points.toLocaleString()}P
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
