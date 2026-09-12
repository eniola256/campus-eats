import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useCustomerAuth } from '../CustomerAuthContext.jsx';

export default function Login() {
  const { completeLogin } = useCustomerAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loginToken, setLoginToken] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | starting | waiting | expired | error
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  async function handleStart(e) {
    e.preventDefault();
    setError(null);
    setStatus('starting');
    try {
      const { loginToken } = await api.authStart(phone, fullName);
      setLoginToken(loginToken);
      setStatus('waiting');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  }

  // While waiting, ask the backend every 2 seconds "has this been
  // confirmed yet?" — this is what makes the page update itself the
  // moment you tap Start in Telegram, without you needing to refresh.
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
        // if 'pending', just keep polling silently
      } catch {
        // a single failed check isn't fatal — just try again next interval
      }
    }, 2000);

    return () => clearInterval(pollRef.current);
  }, [status, loginToken]);

  function reset() {
    setStatus('idle');
    setLoginToken(null);
    setPhone('');
    setFullName('');
  }

  const telegramLink = loginToken
    ? `https://t.me/${import.meta.env.VITE_TELEGRAM_BOT_USERNAME}?start=login_${loginToken}`
    : null;

  return (
    <div className="checkout-page">
      <h1>Log in</h1>

      {status === 'idle' && (
        <form onSubmit={handleStart} className="checkout-form">
          <label>Full name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" required />
          </label>
          <label>Phone number
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09162323354" required />
          </label>
          {error && <p className="state-msg error">{error}</p>}
          <button className="btn-primary" type="submit">Continue</button>
        </form>
      )}

      {status === 'starting' && <p className="state-msg">Starting login…</p>}

      {status === 'waiting' && (
        <div>
          <p className="state-msg">Tap the button below, then press Start in Telegram.</p>
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
          <p className="state-msg error">That login link expired.</p>
          <button className="btn-secondary" onClick={reset}>Try again</button>
        </div>
      )}
    </div>
  );
}