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

function minutesAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('ce_admin_token');
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const all = await Promise.all(ACTIVE_STATUSES.map((s) => api.adminGetOrders(token, s)));
      setOrders(all.flat().sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
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
    openOrder(orderId);
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
        <button className="btn-secondary" onClick={logout}>Log out</button>
      </div>

      <div className="admin-layout">
        <ul className="order-queue">
          {orders.length === 0 && <p className="state-msg">No active orders right now.</p>}
          {orders.map((o) => (
            <li key={o.id} className={`queue-row ${selected?.order.id === o.id ? 'active' : ''}`} onClick={() => openOrder(o.id)}>
              <div>
                <strong>#{o.id} · {o.full_name}</strong>
                <p className="queue-meta">{o.hostel || o.delivery_hostel} · {o.phone}</p>
              </div>
              <span className={`status-badge status-${o.status}`}>{o.status.replace(/_/g, ' ')}</span>
            </li>
          ))}
        </ul>

        {selected && (
          <div className="order-detail">
            <h2>Order #{selected.order.id}</h2>
            <p className="queue-meta">{selected.order.full_name} · {selected.order.phone}</p>
            <p className="queue-meta">Deliver to: {selected.order.delivery_hostel} {selected.order.room_or_gate}</p>

            <ul className="ticket-items">
              {selected.items.map((item) => (
                <li key={item.id} className={item.status !== 'ok' ? 'struck' : ''} style={{ flexWrap: 'wrap' }}>
                  <span>{item.quantity}× {item.product_name}</span>
                  <span>{formatNaira(item.line_total_kobo)}</span>

                  {item.status === 'ok' && !item.contact_attempted_at && (
                    <button className="btn-link" onClick={() => contactCustomer(item.id, selected.order.id)}>
                      contact customer
                    </button>
                  )}

                  {item.status === 'ok' && item.contact_attempted_at && (
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
          </div>
        )}
      </div>
    </div>
  );
}