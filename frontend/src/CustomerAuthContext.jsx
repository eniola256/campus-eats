import { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api.js';

const CustomerAuthContext = createContext(null);
const SESSION_KEY = 'ce_session_token';

export function CustomerAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem(SESSION_KEY));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restore() {
      if (!sessionToken) {
        setLoading(false);
        return;
      }
      try {
        const { customer } = await api.authMe(sessionToken);
        setCustomer(customer);
      } catch {
        localStorage.removeItem(SESSION_KEY);
        setSessionToken(null);
      } finally {
        setLoading(false);
      }
    }
    restore();
  }, []);

  function completeLogin(newSessionToken, newCustomer) {
    localStorage.setItem(SESSION_KEY, newSessionToken);
    setSessionToken(newSessionToken);
    setCustomer(newCustomer);
  }

  async function logout() {
    if (sessionToken) await api.authLogout(sessionToken).catch(() => {});
    localStorage.removeItem(SESSION_KEY);
    setSessionToken(null);
    setCustomer(null);
  }

  return (
    <CustomerAuthContext.Provider value={{ customer, sessionToken, loading, completeLogin, logout }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used inside CustomerAuthProvider');
  return ctx;
}