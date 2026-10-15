import { Routes, Route, useLocation } from 'react-router-dom';
import PublicLayout from './components/PublicLayout.jsx';
import Landing from './pages/Landing.jsx';
import Menu from './pages/Menu.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderTracking from './pages/OrderTracking.jsx';
import MyOrders from './pages/MyOrders.jsx';
import AuthPage from './pages/AuthPage.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminMenu from './pages/AdminMenu.jsx';
import AdminHistory from './pages/AdminHistory.jsx';
import { StoreStatusProvider, Gated } from './StoreStatus.jsx';
import './pages/Admin.css'; // styles for all admin screens

export default function App() {
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;

  return (
    <StoreStatusProvider>
      <div className="app-shell">
        <Routes location={backgroundLocation || location}>
          <Route element={<PublicLayout />}>
            {/* Gated = shows the "we're closed" screen while the store is closed */}
            <Route path="/" element={<Gated><Landing /></Gated>} />
            <Route path="/menu" element={<Gated><Menu /></Gated>} />
            <Route path="/checkout" element={<Gated><Checkout /></Gated>} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/track/:id" element={<OrderTracking />} />
            <Route path="/track/:id/:phone" element={<OrderTracking />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/signup" element={<AuthPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/menu" element={<AdminMenu />} />
          <Route path="/admin/history" element={<AdminHistory />} />
        </Routes>

        {backgroundLocation && (
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route path="/signup" element={<AuthPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Routes>
        )}
      </div>
    </StoreStatusProvider>
  );
}