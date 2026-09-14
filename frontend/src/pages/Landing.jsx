import { Link } from 'react-router-dom';
import { useCustomerAuth } from '../CustomerAuthContext.jsx';
import './Landing.css';


export default function Landing() {
  const { customer } = useCustomerAuth();

  return (
    <div className="landing-page">
      <section className="hero">
      <h1>
        You order,<br />
        We deli<span>ver</span> 
      </h1>
      {customer ? (
        <div className="landing-cta">
          <Link to="/menu" className="btn-primary landing-btn">Go to menu →</Link>
        </div>
      ) : (
        <div className="landing-cta">
          <div className="sign-in">
          <Link to="/signup" className="btn-signup landing-btn">Sign up</Link>
          <Link to="/login" className="btn-login landing-btn">Log in</Link>
          </div>
          <p>and order</p>
        </div>
      )}

      <ul className="landing-benefits">
        <li>No more waiting in line</li>
        <li>No need to come outside</li>
        <li>No need to leave your comfort zone</li>
      </ul>
      </section>
    </div>
  );
}
