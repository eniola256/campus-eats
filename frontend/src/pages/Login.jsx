import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useCustomerAuth } from '../CustomerAuthContext.jsx';

export default function Login() {
  const { completeLogin } = useCustomerAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { sessionToken, customer } = await api.authLogin(phone, password);
      completeLogin(sessionToken, customer);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="checkout-page">
      <h1>Log in</h1>
      <form onSubmit={handleSubmit} className="checkout-form">
        <label>Phone number
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09162323354" required />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="state-msg error">{error}</p>}
        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="note" style={{ marginTop: '1rem' }}>
        New here? <Link to="/signup">Sign up</Link>
      </p>
      <p className="note" style={{ marginTop: '0.5rem' }}>
        <Link to="/forgot-password">Forgot password?</Link>
      </p>
    </div>
  );
}