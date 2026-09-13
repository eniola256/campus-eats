import { Link } from 'react-router-dom';
import { useCustomerAuth } from '../CustomerAuthContext.jsx';
import './Landing.css';

export default function Landing() {
  const { customer } = useCustomerAuth();

  return (
    <div className="landing-page">
      <h1>
        You order.<br />
        We deli<span className="landing-accent">ver.</span>
      </h1>
      <p className="landing-sub">Real food from Yaba's busiest kitchen, walked straight to your hostel gate.</p>

      {customer ? (
        <div className="landing-cta">
          <Link to="/menu" className="btn-primary landing-btn">Go to menu →</Link>
        </div>
      ) : (
        <div className="landing-cta">
          <Link to="/signup" className="btn-primary landing-btn">Sign up and order →</Link>
          <p className="note" style={{ marginTop: '0.6rem' }}>
            Already have an account? <Link to="/login">Log in</Link>
          </p>
          <p className="note" style={{ marginTop: '0.3rem' }}>
            <Link to="/menu">Browse the menu without an account</Link>
          </p>
        </div>
      )}

      <ul className="landing-benefits">
        <li>No more waiting in line</li>
        <li>No need to come outside</li>
        <li>No need to leave your comfort zone</li>
      </ul>
    </div>
  );
}
