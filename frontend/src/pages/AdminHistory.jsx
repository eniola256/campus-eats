import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatNaira } from '../api.js';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'payment_failed', label: 'Payment failed' },
  { value: 'pending_payment', label: 'Waiting for payment' },
  { value: 'payment_confirmed', label: 'Payment confirmed' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
];

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}

const PRESETS = [
  { label: 'Today', range: () => [daysAgo(0), daysAgo(0)] },
  { label: 'Yesterday', range: () => [daysAgo(1), daysAgo(1)] },
  { label: 'Last 7 days', range: () => [daysAgo(6), daysAgo(0)] },
  {
    label: 'This month',
    range: () => {
      const now = new Date();
      return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(now)];
    },
  },
  { label: 'All time', range: () => ['', ''] },
];

const formatWhen = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function OrderDetail({ detail }) {
  if (!detail) return <div className="history-detail"><p className="state-msg">Loading…</p></div>;
  if (detail.error) return <div className="history-detail"><p className="state-msg error">{detail.error}</p></div>;

  const { order, items, refunds } = detail;
  return (
    <div className="history-detail">
      <p className="queue-meta">{order.full_name} · {order.phone}</p>
      <p className="queue-meta">Deliver to: {order.delivery_hostel} {order.room_or_gate}</p>

      <ul className="ticket-items" style={{ marginTop: '0.75rem' }}>
        {items.map((item) => (
          <li key={item.id} className={item.status !== 'ok' ? 'struck' : ''}>
            <span>{item.quantity}× {item.product_name}</span>
            <span>{formatNaira(item.line_total_kobo)}</span>
            {item.status === 'unavailable' && <span className="tag">unavailable</span>}
          </li>
        ))}
      </ul>

      <div className="history-lines">
        <div className="history-line"><span>Subtotal</span><span>{formatNaira(order.subtotal_kobo)}</span></div>
        <div className="history-line"><span>Service fee</span><span>{formatNaira(order.service_fee_kobo)}</span></div>
        <div className="history-line"><span>Delivery fee</span><span>{formatNaira(order.delivery_fee_kobo)}</span></div>
        {order.takeaway_fee_kobo > 0 && (
          <div className="history-line"><span>Takeaway fee</span><span>{formatNaira(order.takeaway_fee_kobo)}</span></div>
        )}
        <div className="history-line" style={{ fontWeight: 700 }}>
          <span>Total</span><span>{formatNaira(order.total_kobo)}</span>
        </div>
      </div>

      {refunds.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <h3 style={{ fontSize: '0.9rem' }}>Refunds</h3>
          <ul className="ticket-items">
            {refunds.map((r) => (
              <li key={r.id}>
                <span>{formatNaira(r.amount_kobo)} — {r.reason.replace(/_/g, ' ')}</span>
                <span className="queue-meta">{r.status === 'pending' ? 'still owed' : 'refunded'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AdminHistory() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('ce_admin_token');
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(daysAgo(0));
  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate('/admin');
      return undefined;
    }
    setExpanded(null);
    setError(null);
    if (from && to && from > to) {
      setData(null);
      setError('The start date is after the end date.');
      return undefined;
    }

    let cancelled = false;
    setData(null);
    api.adminGetHistory(token, { from, to, status })
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [token, from, to, status, navigate]);

  function toggleDetail(id) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    setDetail(null);
    api.adminGetOrder(token, id)
      .then((d) => setDetail({ id, ...d }))
      .catch((err) => setDetail({ id, error: err.message }));
  }

  function logout() {
    sessionStorage.removeItem('ce_admin_token');
    navigate('/admin');
  }

  function applyPreset(preset) {
    const [f, t] = preset.range();
    setFrom(f);
    setTo(t);
  }

  const summary = data?.summary;

  return (
    <div className="admin-dashboard">
      <div className="admin-topbar">
        <h1>Order history</h1>
        <div className="admin-topbar-actions">
          <button className="btn-secondary" onClick={() => navigate('/admin/dashboard')}>Back to orders</button>
          <button className="btn-secondary" onClick={logout}>Log out</button>
        </div>
      </div>

      <div className="history-presets">
        {PRESETS.map((p) => (
          <button key={p.label} className="admin-tab" onClick={() => applyPreset(p)}>{p.label}</button>
        ))}
      </div>

      <div className="history-filters">
        <label className="admin-field">From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="admin-field">To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="admin-field">Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="state-msg error">{error}</p>}
      {!error && !data && <p className="state-msg">Loading…</p>}

      {data && (
        <>
          <div className="history-summary">
            <div className="history-stat"><strong>{summary.total}</strong><span>orders</span></div>
            <div className="history-stat"><strong>{summary.delivered}</strong><span>delivered</span></div>
            <div className="history-stat"><strong>{summary.cancelled}</strong><span>cancelled</span></div>
            <div className="history-stat"><strong>{formatNaira(summary.deliveredKobo)}</strong><span>delivered sales (with fees)</span></div>
          </div>

          {summary.total > data.orders.length && (
            <p className="queue-meta" style={{ marginBottom: '0.75rem' }}>
              Showing the latest {data.orders.length} of {summary.total}. Narrow the dates to see the rest.
            </p>
          )}
          {data.orders.length === 0 && <p className="state-msg">No orders match these filters.</p>}

          <ul className="history-list">
            {data.orders.map((o) => (
              <li key={o.id}>
                <button
                  className={`history-row ${expanded === o.id ? 'open' : ''}`}
                  onClick={() => toggleDetail(o.id)}
                >
                  <div>
                    <strong>#{o.id} · {o.full_name}</strong>
                    <p className="queue-meta">{formatWhen(o.created_at)} · {o.shop_name || 'Unknown shop'} · {o.delivery_hostel}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`status-badge status-${o.status}`}>{o.status.replace(/_/g, ' ')}</span>
                    <p className="queue-meta" style={{ marginTop: '0.3rem' }}>{formatNaira(o.total_kobo)}</p>
                  </div>
                </button>
                {expanded === o.id && <OrderDetail detail={detail?.id === o.id ? detail : null} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
