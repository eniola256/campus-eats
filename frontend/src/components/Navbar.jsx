import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../CartContext.jsx';
import { useCustomerAuth } from '../CustomerAuthContext.jsx';
import './Navbar.css';

export default function Navbar() {
  const { items } = useCart();
  const { customer } = useCustomerAuth();
  const location = useLocation();

  const count = items.reduce((n, i) => n + i.quantity, 0);

  if (location.pathname.startsWith('/admin')) return null;

  return (
    <header className="site-header">
      <Link to="/" className="brand">
        <span className="brand-name">Yaba-deli</span>
      </Link>

      <div className="navbar-actions">
        {!customer ? (
          <Link
            to="/login"
            state={{ backgroundLocation: location }}
            className="nav-pill"
          >
            Sign in
          </Link>
        ) : (
          <>
            <Link to="/menu" className="nav-pill">
              Menu
            </Link>

            <Link to="/checkout" className="nav-pill">
              Cart
              {count > 0 && (
                <span className="cart-count">{count}</span>
              )}
            </Link>

            <Link to="/my-orders" className="nav-pill">
              Orders
            </Link>

            <span className="nav-pill navbar-greeting">
              Welcome, {customer.full_name || customer.phone}
            </span>
          </>
        )}
      </div>
    </header>
  );
}