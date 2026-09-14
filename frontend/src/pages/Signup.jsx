import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useCustomerAuth } from '../CustomerAuthContext.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import AuthModal from '../components/AuthModal.jsx';

export default function Signup() {
  const { completeLogin } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation || location;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginToken, setLoginToken] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const pollRef = useRef(null);

  async function handleStart(e) {
    e.preventDefault();

    setError(null);
    setStatus('starting');

    try {
      const { loginToken } = await api.authSignup(
        fullName,
        phone,
        password
      );

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

          completeLogin(
            result.sessionToken,
            result.customer
          );

          navigate('/menu');
        } else if (result.status === 'expired') {
          clearInterval(pollRef.current);
          setStatus('expired');
        }
      } catch {
        // Keep polling if one request fails.
      }
    }, 2000);

    return () => clearInterval(pollRef.current);
  }, [status, loginToken, completeLogin, navigate]);

  function reset() {
    setStatus('idle');
    setLoginToken(null);
  }

  const telegramLink = loginToken
    ? `https://t.me/${import.meta.env.VITE_TELEGRAM_BOT_USERNAME}?start=login_${loginToken}`
    : null;

  return (
    <AuthModal
      title="Sign up"
      footer={
        status === 'idle' && (
          <>
            Already have an account?{' '}
            <Link
                to="/login"
                state={{ backgroundLocation }}
                className="btn-login landing-btn"
              >
                Log in →
            </Link>
          </>
        )
      }
    >
      {status === 'idle' && (
        <form onSubmit={handleStart}>
          <label>
            Full name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </label>

          <label>
            Phone number
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09162323354"
              required
            />
          </label>

          <label>
            Password
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>

          {error && (
            <p className="state-msg error">
              {error}
            </p>
          )}

          <button
            className="btn-primary"
            type="submit"
          >
            Continue
          </button>
        </form>
      )}

      {status === 'starting' && (
        <p className="state-msg">
          Starting sign up…
        </p>
      )}

      {status === 'waiting' && (
        <div>
          <p className="state-msg">
            One last step — confirm it's really you via Telegram.
          </p>

          <a
            href={telegramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{
              display: 'inline-block',
              textDecoration: 'none',
              marginTop: '0.5rem'
            }}
          >
            Open Telegram to confirm
          </a>

          <p
            className="note"
            style={{ marginTop: '1rem' }}
          >
            Waiting for confirmation…
          </p>
        </div>
      )}

      {status === 'expired' && (
        <div>
          <p className="state-msg error">
            That confirmation link expired.
          </p>

          <button
            className="btn-secondary"
            onClick={reset}
          >
            Try again
          </button>
        </div>
      )}
    </AuthModal>
  );
}