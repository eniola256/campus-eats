import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatNaira } from '../api.js';
import { useCustomerAuth } from '../CustomerAuthContext.jsx';

const ONGOING_STATUSES = new Set(['pending_payment', 'payment_confirmed', 'accepted', 'shopping', 'out_for_delivery']);

const STATUS_LABELS = {
  pending_payment: 'Waiting for payment',
  payment_failed: 'Payment failed',
  payment_confirmed: 'Payment confirmed',
  accepted: 'Order accepted',
  shopping: 'Shopping at the shop',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function OrderRow({ order, phone }) {
  const date = new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <Link to={`/track/${order.id}/${encodeURIComponent(phone)}`} className="queue-row" style={{ textDecoration: 'none', color: 'inherit', marginBottom: '0.5rem' }}>
      <div>
        <strong>Order #{order.id}</strong>
        <p className="queue-meta">{date} · {order.delivery_hostel}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span className="status-badge">{STATUS_LABELS[order.status] || order.status}</span>
        <p className="queue-meta" style={{ marginTop: '0.3rem' }}>{formatNaira(order.total_kobo)}</p>
      </div>
    </Link>
  );
}

export default function MyOrders() {
  const { customer, sessionToken, loading: authLoading } = useCustomerAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return; // wait for login state to finish restoring first
    if (!customer) {
      navigate('/login');
      return;
    }
    api.getMyOrders(sessionToken)
      .then(setOrders)
      .catch((err) => setError(err.message));
  }, [authLoading, customer, sessionToken]);

  if (authLoading || (!error && !orders)) return <p className="state-msg">Loading your orders…</p>;
  if (error) return <p className="state-msg error">{error}</p>;

  const ongoing = orders.filter((o) => ONGOING_STATUSES.has(o.status));
  const history = orders.filter((o) => !ONGOING_STATUSES.has(o.status));

  return (
    <div className="checkout-page">
      <h1>My orders</h1>

      <section style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ongoing</h2>
        {ongoing.length === 0 ? (
          <p className="state-msg">No active orders right now.</p>
        ) : (
          <div style={{ marginTop: '0.75rem' }}>
            {ongoing.map((o) => <OrderRow key={o.id} order={o} phone={customer.phone} />)}
          </div>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>History</h2>
        {history.length === 0 ? (
          <p className="state-msg">No past orders yet.</p>
        ) : (
          <div style={{ marginTop: '0.75rem' }}>
            {history.map((o) => <OrderRow key={o.id} order={o} phone={customer.phone} />)}
          </div>
        )}
      </section>
    </div>
  );
}