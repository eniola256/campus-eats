import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../CartContext.jsx';
import { useCustomerAuth } from '../CustomerAuthContext.jsx';
import './Navbar.css';

export default function Navbar() {
  const { items } = useCart();
  const { customer, logout } = useCustomerAuth();
  const location = useLocation();

  const count = items.reduce((n, i) => n + i.quantity, 0);

  if (location.pathname.startsWith('/admin')) return null;

  return (
    <header className="site-header">
      <Link to="/" className="brand">
        <span className="brand-name">Yaba-deli</span>
      </Link>

      {customer && (
        <nav className="nav-group">
          <Link to="/menu" className="nav-item">
            Menu
          </Link>

          <Link to="/checkout" className="nav-item">
            Cart
            {count > 0 && (
              <span className="cart-count">{count}</span>
            )}
          </Link>

          <Link to="/my-orders" className="nav-item">
            Orders
          </Link>
        </nav>
      )}

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
            <span className="nav-pill navbar-greeting">
              Welcome, {customer.full_name || customer.phone}
            </span>

            <button className="nav-pill" onClick={logout}>
              Log out
            </button>
          </>
        )}
      </div>
    </header>
  );
}