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

// 서비스 페이지 컴포넌트들 임포트
import { Home } from "./pages/Home";
import { PointAndPass } from "./pages/PointAndPass";
import { Ticket } from "./pages/Ticket";
import { MyPage } from "./pages/Mypage";
import { NfcScanPage } from "./pages/NfcScanPage";

// ✅ 실시간 ETA 지도 페이지 임포트 (Default Import 형식)
import ShuttleMap from "./pages/ShuttleMap";

// 쪽지 기능 관련
import { Messages } from "./pages/Messages";
import { MessageDetail } from "./pages/MessageDetail";

/**
 * [제어] 하단 내비게이션 바 노출 여부 결정
 */
const NavigationWrapper = () => {
  const location = useLocation();
  const isAuthenticated = localStorage.getItem("token");

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
        <div className="pb-24">
          <Routes>
            {/* 공개 경로 */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* 보호된 서비스 경로 */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Home />
                </PrivateRoute>
              }
            />

            {/* ✅ 실시간 위치 추적 및 ETA 지도 (여기서 ShuttleMap을 사용함) */}
            <Route
              path="/track"
              element={
                <PrivateRoute>
                  <ShuttleMap />
                </PrivateRoute>
              }
            />

            <Route
              path="/messages"
              element={
                <PrivateRoute>
                  <Messages />
                </PrivateRoute>
              }
            />

            <Route
              path="/messages/:id"
              element={
                <PrivateRoute>
                  <MessageDetail />
                </PrivateRoute>
              }
            />

            <Route
              path="/points"
              element={
                <PrivateRoute>
                  <PointAndPass />
                </PrivateRoute>
              }
            />

            <Route
              path="/ticket/:id"
              element={
                <PrivateRoute>
                  <Ticket />
                </PrivateRoute>
              }
            />

            <Route
              path="/nfc-scan"
              element={
                <PrivateRoute>
                  <NfcScanPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/mypage"
              element={
                <PrivateRoute>
                  <MyPage />
                </PrivateRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        <NavigationWrapper />
      </div>
    </Router>
  );
}

export default App;
