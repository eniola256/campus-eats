import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useCustomerAuth } from '../CustomerAuthContext.jsx';

export default function Signup() {
  const { completeLogin } = useCustomerAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginToken, setLoginToken] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | starting | waiting | expired
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  async function handleStart(e) {
    e.preventDefault();
    setError(null);
    setStatus('starting');
    try {
      const { loginToken } = await api.authSignup(fullName, phone, password);
      setLoginToken(loginToken);
      setStatus('waiting');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  }

  useEffect(() => {
    if (status !== 'waiting' || !loginToken) return;

    pollRef.current = setInterval(async () => {
      try {
        const result = await api.authStatus(loginToken);
        if (result.status === 'confirmed') {
          clearInterval(pollRef.current);
          completeLogin(result.sessionToken, result.customer);
          navigate('/');
        } else if (result.status === 'expired') {
          clearInterval(pollRef.current);
          setStatus('expired');
        }
      } catch {
        // a single failed check isn't fatal — just try again next interval
      }
    }, 2000);

    return () => clearInterval(pollRef.current);
  }, [status, loginToken]);

  function reset() {
    setStatus('idle');
    setLoginToken(null);
  }

  const telegramLink = loginToken
    ? `https://t.me/${import.meta.env.VITE_TELEGRAM_BOT_USERNAME}?start=login_${loginToken}`
    : null;

  return (
    <div className="checkout-page">
      <h1>Sign up</h1>

      {status === 'idle' && (
        <form onSubmit={handleStart} className="checkout-form">
          <label>Full name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
          <label>Phone number
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09162323354" required />
          </label>
          <label>Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          </label>
          {error && <p className="state-msg error">{error}</p>}
          <button className="btn-primary" type="submit">Continue</button>
        </form>
      )}

      {status === 'starting' && <p className="state-msg">Starting sign up…</p>}

      {status === 'waiting' && (
        <div>
          <p className="state-msg">One last step — confirm it's really you via Telegram.</p>
          <a
            href={telegramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ display: 'inline-block', textDecoration: 'none', marginTop: '0.5rem' }}
          >
            Open Telegram to confirm
          </a>
          <p className="note" style={{ marginTop: '1rem' }}>Waiting for confirmation…</p>
        </div>
      )}

      {status === 'expired' && (
        <div>
          <p className="state-msg error">That confirmation link expired.</p>
          <button className="btn-secondary" onClick={reset}>Try again</button>
        </div>
      )}

      {status === 'idle' && (
        <p className="note" style={{ marginTop: '1rem' }}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      )}
    </div>
  );
}