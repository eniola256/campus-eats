import { useNavigate } from 'react-router-dom';
import './AuthModal.css';

export default function AuthModal({ title, children, footer }) {
  const navigate = useNavigate();

  function closeModal() {
    // -1 = "go back to wherever we came from" — since opening the modal
    // was itself a navigation (to /login, /signup, etc.), going back
    // returns to the actual background page instead of always landing
    // on "/" regardless of where the person started.
    navigate(-1);
  }

  return (
    <div className="auth-overlay" onMouseDown={closeModal}>
      <div
        className="auth-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="auth-close"
          onClick={closeModal}
          aria-label="Close"
        >
          ×
        </button>

        <h1>{title}</h1>

        {children}

        {footer && (
          <div className="auth-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}