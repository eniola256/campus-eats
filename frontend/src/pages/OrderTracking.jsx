import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, formatNaira } from '../api.js';

const STEPS = ['payment_confirmed', 'accepted', 'shopping', 'out_for_delivery', 'delivered'];
const STEP_LABELS = {
  payment_confirmed: 'Payment confirmed',
  accepted: 'Order accepted',
  shopping: 'Shopping at the shop',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
};

export default function OrderTracking() {
  const { id, phone: phoneFromPath } = useParams();
  const [searchParams] = useSearchParams();
  const phone = phoneFromPath || searchParams.get('phone');
  const reference = searchParams.get('paymentReference') || searchParams.get('reference');

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(!!reference);

  useEffect(() => {
    async function load() {
      try {
        if (reference) {
          await api.verifyPayment(reference).catch(() => null);
          setVerifying(false);
        }
        const result = await api.getOrder(id, phone);
        setData(result);
      } catch (err) {
        setError(err.message);
      }
    }
    if (phone) load();
    else setError('Missing phone number for order lookup.');

    const interval = setInterval(() => {
      if (phone) api.getOrder(id, phone).then(setData).catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
  }, [id, phone, reference]);

  if (error) return <p className="state-msg error">{error}</p>;
  if (!data) return <p className="state-msg">{verifying ? 'Confirming your payment…' : 'Loading your order…'}</p>;

  const { order, items } = data;
  const currentStepIndex = order.status === 'cancelled' ? -1 : STEPS.indexOf(order.status);

  return (
    <div className="tracking-page">
      <div className="ticket">
        <div className="ticket-notch" />
        <p className="ticket-eyebrow">Order #{order.id}</p>
        <h1>{STEP_LABELS[order.status] || order.status}</h1>

        {order.status === 'cancelled' ? (
          <p className="state-msg error">This order was cancelled.</p>
        ) : (
          <ol className="progress-trail">
            {STEPS.map((step, i) => (
              <li key={step} className={i <= currentStepIndex ? 'done' : ''}>
                {STEP_LABELS[step]}
              </li>
            ))}
          </ol>
        )}

        <div className="ticket-divider" />

        <ul className="ticket-items">
          {items.map((item, i) => (
            <li key={i} className={item.status !== 'ok' ? 'struck' : ''}>
              <span>{item.quantity}× {item.product_name}</span>
              <span>{formatNaira(item.line_total_kobo)}</span>
              {item.status === 'unavailable' && <span className="tag">refunded</span>}
            </li>
          ))}
        </ul>

        <div className="ticket-divider" />

        <div className="ticket-total">
          <span>Total</span>
          <span>{formatNaira(order.total_kobo)}</span>
        </div>
        <p className="ticket-meta">Delivering to {order.delivery_hostel}{order.delivery_note ? `, ${order.delivery_note}` : ''}</p>
      </div>
    </div>
  );
}