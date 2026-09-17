import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useCustomerAuth } from '../CustomerAuthContext.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import AuthModal from '../components/AuthModal.jsx';
import './AuthPage.css';

// One component handles BOTH /login and /signup. Switching between them
// is a local state change (a button click), never a navigation — so no
// extra entry gets added to browser history, and closing the modal
// always takes exactly one "back" step, no matter how many times you've
// toggled between the two modes.
export default function AuthPage() {
  const { completeLogin } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation || location;

  // Mode comes from the actual URL, not a separate flag — so the address
  // bar and what's displayed can never drift out of sync.
  const mode = location.pathname === '/signup' ? 'signup' : 'login';

  function switchMode(newMode) {
    setError(null);
    // replace: true swaps the current history entry instead of pushing a
    // new one — the URL still updates to match, but the "stack" stays
    // exactly one deep.
    navigate(newMode === 'signup' ? '/signup' : '/login', {
      replace: true,
      state: { backgroundLocation },
    });
  }

  // Shared between both modes
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  // Login-only
  const [submitting, setSubmitting] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // Signup-only
  const [fullName, setFullName] = useState('');
  const [loginToken, setLoginToken] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | starting | waiting | expired
  const pollRef = useRef(null);

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { sessionToken, customer } = await api.authLogin(phone, password);
      completeLogin(sessionToken, customer);
      navigate('/menu');
    } catch (err) {
      setError(err.message);
      if (err.message.includes('cannot log in at this time')) setBlocked(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignupStart(e) {
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
    if (mode !== 'signup' || status !== 'waiting' || !loginToken) return;

    pollRef.current = setInterval(async () => {
      try {
        const result = await api.authStatus(loginToken);
        if (result.status === 'confirmed') {
          clearInterval(pollRef.current);
          completeLogin(result.sessionToken, result.customer);
          navigate('/menu');
        } else if (result.status === 'expired') {
          clearInterval(pollRef.current);
          setStatus('expired');
        }
      } catch {
        // a single failed check isn't fatal — just try again next interval
      }
    }, 2000);

    return () => clearInterval(pollRef.current);
  }, [mode, status, loginToken, completeLogin, navigate]);

  function resetSignup() {
    setStatus('idle');
    setLoginToken(null);
  }

  const telegramLink = loginToken
    ? `https://t.me/${import.meta.env.VITE_TELEGRAM_BOT_USERNAME}?start=login_${loginToken}`
    : null;

  if (mode === 'login') {
    return (
      <AuthModal
        title="Log in"
        footer={
          <>
            New here?{' '}
            <button type="button" className="link-btn" onClick={() => switchMode('signup')}>
              Sign up →
            </button>
            <br />
            <Link to="/forgot-password" state={{ backgroundLocation }}>
              Forgot password?
            </Link>
          </>
        }
      >
        <form onSubmit={handleLogin} className="auth-form">
          <label>Phone number
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09162323354" required disabled={blocked} />
          </label>
          <label>Password
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required disabled={blocked} />
          </label>
          {error && <p className="state-msg error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={submitting || blocked}>
            {blocked ? 'Try again later' : submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </AuthModal>
    );
  }

  return (
    <AuthModal
      title="Sign up"
      footer={
        status === 'idle' && (
          <>
            Already have an account?{' '}
            <button type="button" className="link-btn" onClick={() => switchMode('login')}>
              Log in →
            </button>
          </>
        )
      }
    >
      {status === 'idle' && (
        <form onSubmit={handleSignupStart} className="auth-form">
          <label>Full name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
          <label>Phone number
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09162323354" required />
          </label>
          <label>Password
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
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
          <button className="btn-secondary" onClick={resetSignup}>Try again</button>
        </div>
      )}
    </AuthModal>
  );
}