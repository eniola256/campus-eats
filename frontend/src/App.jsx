import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Menu from './pages/Menu.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderTracking from './pages/OrderTracking.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import { useCart } from './CartContext.jsx';

function Header() {
  const { items } = useCart();
  const location = useLocation();
  const count = items.reduce((n, i) => n + i.quantity, 0);
  if (location.pathname.startsWith('/admin')) return null;

  return (
    <header className="site-header">
      <Link to="/" className="brand">
        <span className="brand-mark">CE</span>
        <span className="brand-name">Campus Eats</span>
      </Link>
      <Link to="/checkout" className="cart-pill">
        Cart {count > 0 && <span className="cart-count">{count}</span>}
      </Link>
    </header>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Menu />} />
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