import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useCustomerAuth } from '../CustomerAuthContext.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import AuthModal from '../components/AuthModal.jsx';

export default function Login() {
  const { completeLogin } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Keep pointing at whatever page was ACTUALLY open before any modal
  // appeared — not this modal's own location. Without this, hopping from
  // Login to Signup would treat "/login" itself as the background page.
  const backgroundLocation = location.state?.backgroundLocation || location;

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [blocked, setBlocked] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    setError(null);
    setSubmitting(true);

    try {
      const { sessionToken, customer } =
        await api.authLogin(phone, password);

      completeLogin(sessionToken, customer);
      navigate('/menu');
    } catch (err) {
      setError(err.message);

      if (
        err.message.includes(
          'cannot log in at this time'
        )
      ) {
        setBlocked(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthModal
      title="Log in"
      footer={
        <>
          New here?{' '}
          <Link
              to="/signup"
              state={{ backgroundLocation }}
              className="btn-signup landing-btn"
            >
              Sign up →
          </Link>

          <br />

          <Link to="/forgot-password" state={{ backgroundLocation }}>
            Forgot password?
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <label>
          Phone number
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09162323354"
            required
            disabled={blocked}
          />
        </label>

        <label>
          Password
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={blocked}
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
          disabled={submitting || blocked}
        >
          {blocked
            ? 'Try again later'
            : submitting
              ? 'Logging in…'
              : 'Log in'}
        </button>
      </form>
    </AuthModal>
  );
}