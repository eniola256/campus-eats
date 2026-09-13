import { Routes, Route, Link, useLocation } from 'react-router-dom';
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
import { useCart } from './CartContext.jsx';
import { useCustomerAuth } from './CustomerAuthContext.jsx';

function Header() {
  const { items } = useCart();
  const { customer, logout } = useCustomerAuth();
  const location = useLocation();
  const count = items.reduce((n, i) => n + i.quantity, 0);
  if (location.pathname.startsWith('/admin')) return null;

  return (
    <header className="site-header">
      <Link to="/" className="brand">
        <span className="brand-mark">CE</span>
        <span className="brand-name">Campus Eats</span>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Link to="/menu" className="btn-secondary" style={{ textDecoration: 'none', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
          Menu
        </Link>
        {customer ? (
          <>
            <Link to="/my-orders" className="btn-secondary" style={{ textDecoration: 'none', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
              My orders
            </Link>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Hi, {customer.full_name || customer.phone}</span>
            <button className="btn-secondary" onClick={logout} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
              Log out
            </button>
          </>
        ) : (
          <Link to="/login" className="btn-secondary" style={{ textDecoration: 'none', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            Log in
          </Link>
        )}
        <Link to="/checkout" className="cart-pill">
          Cart {count > 0 && <span className="cart-count">{count}</span>}
        </Link>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/my-orders" element={<MyOrders />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/track/:id" element={<OrderTracking />} />
          <Route path="/track/:id/:phone" element={<OrderTracking />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Routes>
      </main>
    </div>
  );
}