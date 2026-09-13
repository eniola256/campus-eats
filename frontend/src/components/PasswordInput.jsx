import { useState } from 'react';

// A password <input> with a show/hide toggle. Reused across Login,
// Signup, and ForgotPassword so the behavior stays consistent everywhere
// instead of copy-pasting the same toggle logic three times.
export default function PasswordInput({ value, onChange, minLength, required, disabled }) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        minLength={minLength}
        required={required}
        disabled={disabled}
        style={{ width: '100%', paddingRight: '2.75rem' }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: '0.6rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.1rem',
          lineHeight: 1,
          padding: 0,
        }}
      >
        {visible ? '🙈' : '👁️'}
      </button>
    </div>
  );
}