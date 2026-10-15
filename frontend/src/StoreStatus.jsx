import { createContext, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api.js';
import './StoreStatus.css';

const StoreStatusContext = createContext({ ready: true, open: true, message: '' });
const POLL_MS = 60000; // re-check every minute, so a tab left open notices a closing

export function StoreStatusProvider({ children }) {
  const [status, setStatus] = useState({ ready: false, open: true, message: '' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const s = await api.getStoreStatus();
        if (!cancelled) setStatus({ ready: true, open: s.open, message: s.message });
      } catch {
        // Can't reach the server: don't lock customers out because of a
        // network blip. The server refuses orders itself while closed.
        if (!cancelled) setStatus((prev) => ({ ...prev, ready: true }));
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return <StoreStatusContext.Provider value={status}>{children}</StoreStatusContext.Provider>;
}

export function useStoreStatus() {
  return useContext(StoreStatusContext);
}

function ClosedPage({ message }) {
  return (
    <div className="closed-page">
      <span className="material-symbols-outlined closed-icon">storefront</span>
      <h1>We're closed right now</h1>
      <p>{message}</p>
      <Link to="/my-orders" className="closed-link">Track my orders</Link>
    </div>
  );
}

// Wrap the pages that lead to placing an order. When the store is closed they
// show the closed screen instead; order tracking, My orders and login stay
// reachable so customers with an order in progress can still follow it.
export function Gated({ children }) {
  const { ready, open, message } = useStoreStatus();
  if (!ready) return <p className="state-msg">Loading…</p>;
  if (!open) return <ClosedPage message={message} />;
  return children;
}
