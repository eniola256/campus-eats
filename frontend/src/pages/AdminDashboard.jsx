import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatNaira } from '../api.js';

const NEXT_STATUS = {
  payment_confirmed: 'accepted',
  accepted: 'shopping',
  shopping: 'out_for_delivery',
  out_for_delivery: 'delivered',
};
const NEXT_LABEL = {
  payment_confirmed: 'Accept order',
  accepted: 'Start shopping',
  shopping: 'Mark out for delivery',
  out_for_delivery: 'Mark delivered',
};
const ACTIVE_STATUSES = ['payment_confirmed', 'accepted', 'shopping', 'out_for_delivery'];
// Must match CANCELLABLE in backend admin.js
const CANCELLABLE_STATUSES = ['payment_confirmed', 'accepted', 'shopping'];

function minutesAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

// Open/close switch for the whole store. While closed, customers see a
// "we're closed" screen and the server refuses new orders; orders already
// paid for carry on as normal.
function StoreControl({ token }) {
  const [store, setStore] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getStoreStatus()
      .then((s) => {
        setStore(s);
        if (!s.open) setMessage(s.message);
      })
      .catch(() => {});
  }, []);

  async function setOpen(open) {
    if (!open && !window.confirm('Close the store? Customers won\'t be able to place new orders.')) return;
    setBusy(true);
    setError(null);
    try {
      setStore(await api.adminSetStore(token, open, open ? undefined : message.trim()));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!store) return null;

  return (
    <div className={`store-control ${store.open ? 'is-open' : 'is-closed'}`}>
      <div>
        <strong>{store.open ? 'Store is open' : 'Store is closed'}</strong>
        <p className="queue-meta">
          {store.open ? 'Customers can place orders.' : `Customers see: "${store.message}"`}
        </p>
      </div>
      {store.open && (
        <input
          className="store-message"
          type="text"
          maxLength={200}
          placeholder="Message for customers while closed (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      )}
      <button className={store.open ? 'btn-secondary btn-danger' : 'btn-primary'} onClick={() => setOpen(!store.open)} disabled={busy}>
        {store.open ? 'Close store' : 'Open store'}
      </button>
      {error && <span className="admin-msg error">{error}</span>}
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('ce_admin_token');
  const [orders, setOrders] = useState([]);
  const [pendingRefunds, setPendingRefunds] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [orderLists, refunds] = await Promise.all([
        Promise.all(ACTIVE_STATUSES.map((s) => api.adminGetOrders(token, s))),
        api.adminGetRefunds(token, 'pending'),
      ]);
      setOrders(orderLists.flat().sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
      setPendingRefunds(refunds);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return navigate('/admin');
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [token, refresh, navigate]);

  async function openOrder(id) {
    const detail = await api.adminGetOrder(token, id);
    setSelected(detail);
  }

  async function advance(order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    await api.adminSetStatus(token, order.id, next);
    await refresh();
    if (selected?.order.id === order.id) openOrder(order.id);
  }

  async function cancelOrder(order) {
    const ok = window.confirm(
      `Cancel order #${order.id}? The customer will be owed a refund of ${formatNaira(order.total_kobo)}.`
    );
    if (!ok) return;
    try {
      await api.adminCancelOrder(token, order.id);
      await refresh();
      openOrder(order.id); // keep it open so the refund owed shows right away
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function contactCustomer(itemId, orderId) {
    await api.adminContactCustomer(token, itemId);
    openOrder(orderId);
  }

  async function markUnavailable(itemId, orderId) {
    await api.adminMarkUnavailable(token, itemId);
    openOrder(orderId);
    refresh();
  }

  async function markRefunded(refundId, orderId) {
    await api.adminMarkRefunded(token, refundId);
    await refresh();
    if (selected?.order.id === orderId) openOrder(orderId);
  }

  function logout() {
    sessionStorage.removeItem('ce_admin_token');
    navigate('/admin');
  }

  if (error) return <p className="state-msg error">{error}</p>;

  return (
    <div className="admin-dashboard">
      <div className="admin-topbar">
        <h1>Orders</h1>
        <div className="admin-topbar-actions">
          <button className="btn-secondary" onClick={() => navigate('/admin/history')}>History</button>
          <button className="btn-secondary" onClick={() => navigate('/admin/menu')}>Menu &amp; shops</button>
          <button className="btn-secondary" onClick={logout}>Log out</button>
        </div>
      </div>

      <StoreControl token={token} />

      {pendingRefunds.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.9rem' }}>Refunds owed</h3>
          <ul className="ticket-items">
            {pendingRefunds.map((r) => (
              <li key={r.id} style={{ flexWrap: 'wrap' }}>
                <span>
                  #{r.order_number} · {r.full_name} · {r.phone} — {formatNaira(r.amount_kobo)} ({r.reason.replace(/_/g, ' ')})
                </span>
                <button className="btn-link" onClick={() => markRefunded(r.id, r.order_id)}>
                  mark refunded
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="admin-layout">
        <ul className="order-queue">
          {orders.length === 0 && <p className="state-msg">No active orders right now.</p>}
          {orders.map((o) => (
            <li key={o.id} className={`queue-row ${selected?.order.id === o.id ? 'active' : ''}`} onClick={() => openOrder(o.id)}>
              <div>
                <strong>#{o.id} · {o.full_name}</strong>
                <p className="queue-meta" style={{ fontWeight: 700 }}>Buy from: {o.shop_name || 'Unknown shop'}</p>
                <p className="queue-meta">{o.hostel || o.delivery_hostel} · {o.phone}</p>
              </div>
              <span className={`status-badge status-${o.status}`}>{o.status.replace(/_/g, ' ')}</span>
            </li>
          ))}
        </ul>

        {selected && (
          <div className="order-detail">
            <h2>Order #{selected.order.id}</h2>
            <p className="queue-meta" style={{ fontWeight: 700 }}>Buy from: {selected.order.shop_name || 'Unknown shop'}</p>
            <p className="queue-meta">{selected.order.full_name} · {selected.order.phone}</p>
            <p className="queue-meta">Deliver to: {selected.order.delivery_hostel} {selected.order.room_or_gate}</p>
            {selected.order.status === 'cancelled' && <span className="tag">cancelled</span>}

            <ul className="ticket-items">
              {selected.items.map((item) => (
                <li key={item.id} className={item.status !== 'ok' ? 'struck' : ''} style={{ flexWrap: 'wrap' }}>
                  <span>{item.quantity}× {item.product_name}</span>
                  <span>{formatNaira(item.line_total_kobo)}</span>

                  {item.status === 'ok' && !item.contact_attempted_at && selected.order.status !== 'cancelled' && (
                    <button className="btn-link" onClick={() => contactCustomer(item.id, selected.order.id)}>
                      contact customer
                    </button>
                  )}

                  {item.status === 'ok' && item.contact_attempted_at && selected.order.status !== 'cancelled' && (
                    <>
                      <span className="note" style={{ marginTop: 0 }}>
                        contacted {minutesAgo(item.contact_attempted_at)}m ago
                      </span>
                      <button className="btn-link" onClick={() => markUnavailable(item.id, selected.order.id)}>
                        confirm unavailable &amp; refund
                      </button>
                    </>
                  )}

                  {item.status === 'unavailable' && <span className="tag">unavailable</span>}
                </li>
              ))}
            </ul>

            <div className="ticket-total">
              <span>Total</span>
              <span>{formatNaira(selected.order.total_kobo)}</span>
            </div>

            {selected.refunds && selected.refunds.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h3 style={{ fontSize: '0.9rem' }}>Refunds owed</h3>
                <ul className="ticket-items">
                  {selected.refunds.map((r) => (
                    <li key={r.id}>
                      <span>{formatNaira(r.amount_kobo)} — {r.reason.replace(/_/g, ' ')}</span>
                      {r.status === 'pending' ? (
                        <button className="btn-link" onClick={() => markRefunded(r.id, selected.order.id)}>
                          mark refunded
                        </button>
                      ) : (
                        <span className="tag" style={{ background: '#2b6e63' }}>refunded</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {NEXT_STATUS[selected.order.status] && (
              <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => advance(selected.order)}>
                {NEXT_LABEL[selected.order.status]}
              </button>
            )}

            {CANCELLABLE_STATUSES.includes(selected.order.status) && (
              <button
                className="btn-secondary btn-danger"
                style={{ marginTop: '0.75rem', marginLeft: NEXT_STATUS[selected.order.status] ? '0.5rem' : 0 }}
                onClick={() => cancelOrder(selected.order)}
              >
                Cancel order
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}