import { Routes, Route, useLocation } from 'react-router-dom';
import PublicLayout from './components/PublicLayout.jsx';
import Landing from './pages/Landing.jsx';
import Menu from './pages/Menu.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderTracking from './pages/OrderTracking.jsx';
import MyOrders from './pages/MyOrders.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

export default function App() {
  const location = useLocation();
  // Links that open a modal pass backgroundLocation in their state — when
  // present, we render the ROUTES AS IF we were still on that page (so it
  // stays mounted underneath), then render the modal route separately, on
  // top, in a second <Routes> block below.
  const backgroundLocation = location.state?.backgroundLocation;

  return (
    <div className="app-shell">
      <Routes location={backgroundLocation || location}>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/my-orders" element={<MyOrders />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/track/:id" element={<OrderTracking />} />
          <Route path="/track/:id/:phone" element={<OrderTracking />} />
          {/* Also matched here as a plain fallback — someone landing
              directly on /login (a fresh page load, a shared link, a
              refresh) has no backgroundLocation to speak of, so it just
              renders as a normal full page instead of an empty overlay. */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>

      {/* The actual modal overlay — only rendered when we arrived via a
          Link that set backgroundLocation, meaning the page underneath is
          still mounted from the block above. */}
      {backgroundLocation && (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Routes>
      )}
    </div>
  );
}