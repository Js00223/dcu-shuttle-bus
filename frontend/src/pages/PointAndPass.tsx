import { useState, useEffect, useCallback } from "react";
import axios, { AxiosError } from "axios";

// ✅ 환경 설정
const BACKEND_URL = "https://dcu-shuttle-bus.onrender.com";
const CHARGE_FEE = 330;
const SEMESTER_PASS_PRICE = 150000; // 정기권 가격 예시 (15만 포인트)

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

// ✅ 아임포트(IMP) 전역 타입 정의
declare global {
  interface Window {
    IMP: any;
  }
}

export const PointAndPass = () => {
  const [points, setPoints] = useState<number>(0);
  const [hasPass, setHasPass] = useState<boolean>(false);
  const [expiryDate, setExpiryDate] = useState<string | undefined>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // 1. 사용자 상태 불러오기
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

  // 2. 가상계좌 입금 타이머
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

  // 3. 포인트 충전 요청 (아임포트 적용)
  const handleRequestCharge = async (amount: number) => {
    const { IMP } = window;
    if (!IMP) {
      alert("결제 모듈을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    // ✅ 아임포트 초기화
    IMP.init("imp77764653"); 

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = user.user_id || user.id;
    const totalAmount = amount + CHARGE_FEE;

    // 결제 데이터 설정
    const paymentData = {
      pg: "html5_inicis",           // PG사 선택
      pay_method: "card",           // 결제수단 (카드)
      merchant_uid: `mid_${new Date().getTime()}`, // 주문번호
      name: `${amount}P 포인트 충전`, // 상품명
      amount: totalAmount,          // 실 결제 금액
      buyer_email: user.email || "",
      buyer_name: user.name || "사용자",
    };

    // ✅ 결제창 호출
    IMP.request_pay(paymentData, async (rsp: any) => {
      if (rsp.success) {
        try {
          // 결제 성공 시 서버에 결제 정보 전달 및 검증 요청
          await axios.post(`${BACKEND_URL}/api/charge/request`, { 
            user_id: userId,
            amount: amount,
            imp_uid: rsp.imp_uid,
            merchant_uid: rsp.merchant_uid
          });
          
          alert("결제가 완료되었습니다!");
          await fetchUserStatus(); // 포인트 정보 최신화
        } catch (err) {
          console.error("서버 결제 검증 실패:", err);
          alert("결제는 성공했으나 서버 반영에 실패했습니다. 고객센터로 문의 바랍니다.");
        }
      } else {
        alert(`결제 실패: ${rsp.error_msg}`);
      }
    });
  };

  // 🌟 [추가 기능] 정기권 신청 (구매)
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

      alert("정기권 신청이 완료되었습니다! 이제 자유롭게 이용 가능합니다.");
      await fetchUserStatus(); // 포인트 차감 및 정기권 상태 갱신
    } catch (err) {
      const axiosError = err as AxiosError<BackendError>;
      alert(axiosError.response?.data?.detail || "정기권 신청 중 에러가 발생했습니다.");
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse">데이터 로드 중...</div>;

  return (
    <div className="min-h-screen bg-[#F2F2F7] p-4 pb-24 font-pretendard">
      {/* 포인트 카드 */}
      <div className="bg-white rounded-3xl p-8 shadow-sm mb-6 border border-gray-100">
        <p className="text-gray-400 text-sm mb-2 font-medium">나의 잔여 포인트</p>
        <h1 className="text-4xl font-black text-gray-900">
          {(points ?? 0).toLocaleString()} <span className="text-2xl">P</span>
        </h1>
      </div>

      {/* 충전 버튼 그리드 */}
      {!pendingPayment && (
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
      )}

      {/* 🌟 정기권 섹션 */}
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
              * 신청 즉시 포인트가 차감되며, 해당 학기 동안 무제한 이용 가능합니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
