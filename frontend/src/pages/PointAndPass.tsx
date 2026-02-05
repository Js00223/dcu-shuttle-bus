import { useState, useEffect, useCallback } from "react";
import axios, { AxiosError } from "axios";

// ✅ 백엔드 주소 확인
const BACKEND_URL = "https://dcu-shuttle-bus.onrender.com";
const CHARGE_FEE = 330;

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
      
      // ✅ 로컬스토리지에서 실제 로그인된 유저 ID 가져오기
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      if (!userId) {
        console.error("유저 정보를 찾을 수 없습니다.");
        return;
      }

      // ✅ 경로에 /api 추가 및 params 수정
      const response = await axios.get<UserStatus>(
        `${BACKEND_URL}/api/user/status`, 
        {
          params: { user_id: userId },
        }
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
        alert("입금 기한이 만료되었습니다.");
      } else {
        setTimeLeft(Math.floor((distance % (1000 * 60)) / 1000));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingPayment]);

  // 3. 충전 요청
  const handleRequestCharge = async (amount: number) => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      // ✅ 경로에 /api 추가
      const response = await axios.post<PendingPayment>(
        `${BACKEND_URL}/api/charge/request`,
        { 
          user_id: userId, // 백엔드에서 누구의 충전인지 알아야 함
          amount: amount 
        }
      );
      setPendingPayment(response.data);
    } catch (err) {
      console.error("충전 요청 에러:", err);
      alert("충전 요청에 실패했습니다.");
    }
  };

  // 4. 입금 확인
  const handleConfirmCharge = async () => {
    if (!pendingPayment) return;
    try {
      // ✅ 경로에 /api 추가
      await axios.post(
        `${BACKEND_URL}/api/charge/confirm/${pendingPayment.payment_id}`
      );

      alert(`${pendingPayment.amount}P 충전이 완료되었습니다!`);
      await fetchUserStatus();
      setPendingPayment(null);
    } catch (err) {
      const axiosError = err as AxiosError<BackendError>;
      alert(axiosError.response?.data?.detail || "충전 확인에 실패했습니다.");
    }
  };

  if (loading)
    return (
      <div className="p-10 text-center animate-pulse text-gray-400 font-bold">
        데이터 로드 중...
      </div>
    );

  return (
    <div className="min-h-screen bg-[#F2F2F7] p-4 pb-24 font-pretendard">
      <div className="bg-white rounded-3xl p-8 shadow-sm mb-6 border border-gray-100">
        <p className="text-gray-400 text-sm mb-2 font-medium">나의 잔여 포인트</p>
        <h1 className="text-4xl font-black text-gray-900">
          {(points ?? 0).toLocaleString()} <span className="text-2xl">P</span>
        </h1>
      </div>

      {pendingPayment && (
        <div className="bg-blue-600 rounded-3xl p-6 mb-6 text-white shadow-xl animate-in fade-in zoom-in duration-300">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-lg">가상계좌 입금 대기 중</h3>
            <span className="bg-red-500 text-[10px] px-2 py-1 rounded-full font-bold">
              {timeLeft}초 남음
            </span>
          </div>
          <div className="bg-blue-700/50 rounded-2xl p-4 mb-4 text-sm space-y-2">
            <p className="flex justify-between">
              <span>입금하실 금액:</span>
              <b>{(pendingPayment.amount + CHARGE_FEE).toLocaleString()}원</b>
            </p>
            <p className="flex justify-between">
              <span>입금 계좌:</span> <b>{pendingPayment.account}</b>
            </p>
          </div>
          <button
            onClick={handleConfirmCharge}
            className="w-full py-3 bg-white text-blue-600 rounded-xl font-black active:scale-95 transition-transform"
          >
            입금 완료했습니다
          </button>
          <button
            onClick={() => setPendingPayment(null)}
            className="w-full mt-2 text-xs text-blue-200"
          >
            취소하기
          </button>
        </div>
      )}

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

      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
        <h3 className="font-black text-gray-800 mb-4">시외 학기권 상태</h3>
        {hasPass ? (
          <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
            <p className="text-green-700 font-black text-sm">정기권이 활성화 되었습니다! ✅</p>
            <p className="text-green-600 text-xs font-bold italic">만료 예정: {expiryDate}</p>
          </div>
        ) : (
          <div className="text-gray-500 text-sm py-4">보유 중인 학기권이 없습니다.</div>
        )}
      </div>
    </div>
  );
};
