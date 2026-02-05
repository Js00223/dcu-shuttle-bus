import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { BottomNav } from "./components/BottomNav";

// 인증(Auth) 관련 페이지 임포트
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { ForgotPassword } from "./pages/ForgotPassword";

// 기존 서비스 페이지 컴포넌트들 임포트
import { Home } from "./pages/Home";
import { BusTrackingPage } from "./pages/BusTrackingPage";
import { PointAndPass } from "./pages/PointAndPass";
import { Ticket } from "./pages/Ticket";
import { MyPage } from "./pages/Mypage";
import { NfcScanPage } from "./pages/NfcScanPage";

// ✅ 쪽지 기능 관련 (중복 임포트 제거 및 정리)
import { Messages } from "./pages/Messages";
import { MessageDetail } from "./pages/MessageDetail";

/**
 * [제어] 하단 내비게이션 바 노출 여부 결정
 */
const NavigationWrapper = () => {
  const location = useLocation();
  const isAuthenticated = localStorage.getItem("token");

  // 하단바를 숨길 경로 리스트
  const hideNavPaths = ["/login", "/signup", "/forgot-password"];
  const isHidePath = hideNavPaths.includes(location.pathname);

  if (isHidePath || !isAuthenticated) {
    return null;
  }

  return <BottomNav />;
};

/**
 * [보안] 인증 체크 컴포넌트
 */
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = localStorage.getItem("token");
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#F2F2F7]">
        {/* 하단 내비게이션 바 공간 확보를 위한 padding-bottom */}
        <div className="pb-24">
          <Routes>
            {/* --- [공개 경로] --- */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* --- [보호된 서비스 경로] --- */}

            {/* 1. 홈 */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Home />
                </PrivateRoute>
              }
            />

            {/* 2. 실시간 위치 추적 */}
            <Route
              path="/track"
              element={
                <PrivateRoute>
                  <BusTrackingPage routeId={1} />
                </PrivateRoute>
              }
            />

            {/* 3. 쪽지함 목록 */}
            <Route
              path="/messages"
              element={
                <PrivateRoute>
                  <Messages />
                </PrivateRoute>
              }
            />

            {/* ✅ 4. 쪽지 상세 보기 (로그인 체크 적용) */}
            <Route
              path="/messages/:id"
              element={
                <PrivateRoute>
                  <MessageDetail />
                </PrivateRoute>
              }
            />

            {/* 5. 포인트/학기권 충전 */}
            <Route
              path="/points"
              element={
                <PrivateRoute>
                  <PointAndPass />
                </PrivateRoute>
              }
            />

            {/* 6. 승차권 상세 (NFC/QR) */}
            <Route
              path="/ticket/:id"
              element={
                <PrivateRoute>
                  <Ticket />
                </PrivateRoute>
              }
            />

            {/* 7. 학생증 NFC 스캔 */}
            <Route
              path="/nfc-scan"
              element={
                <PrivateRoute>
                  <NfcScanPage />
                </PrivateRoute>
              }
            />

            {/* 8. 마이페이지 */}
            <Route
              path="/mypage"
              element={
                <PrivateRoute>
                  <MyPage />
                </PrivateRoute>
              }
            />

            {/* 잘못된 경로는 홈으로 리다이렉트 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        {/* 경로 및 인증 상태에 따른 하단바 렌더링 */}
        <NavigationWrapper />
      </div>
    </Router>
  );
}

export default App;
