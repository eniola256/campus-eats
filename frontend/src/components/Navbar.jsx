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
    <>
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
            <button className="nav-pill" onClick={logout}>
              Log out
            </button>
          )}
        </div>
      </header>

      {/* Mobile-only bottom tab bar — same links as .nav-group above,
          just a different layout for small screens. Both are always in
          the DOM; the media query in Navbar.css decides which one shows,
          so no JS/resize-listener logic is needed to switch between them. */}
      {customer && (
        <nav className="bottom-tab-bar">
          <Link to="/menu" className="tab-item">
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span className="tab-label">Menu</span>
          </Link>

          <Link to="/checkout" className="tab-item">
            <span className="material-symbols-outlined">shopping_cart</span>
            <span className="tab-label">Cart</span>
            {count > 0 && (
              <span className="cart-count tab-cart-count">{count}</span>
            )}
          </Link>

          <Link to="/my-orders" className="tab-item">
            <span className="material-symbols-outlined">receipt_long</span>
            <span className="tab-label">Orders</span>
          </Link>
        </nav>
      )}
    </>
  );
}