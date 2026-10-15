import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../CartContext.jsx';
import { useCustomerAuth } from '../CustomerAuthContext.jsx';
import { api, formatNaira } from '../api.js';
import './Checkout.css';

const MIN_ORDER_KOBO = 150000;

export default function Checkout() {
  const { items, updateQuantity, subtotalKobo, clearCart, shopName } = useCart();
  const { customer } = useCustomerAuth();
  const [form, setForm] = useState({ fullName: '', phone: '', hostel: '', roomOrGate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fees, setFees] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (customer) {
      setForm((prev) => ({
        fullName: customer.full_name || prev.fullName,
        phone: customer.phone || prev.phone,
        hostel: customer.hostel || prev.hostel,
        roomOrGate: customer.room_or_gate || prev.roomOrGate,
      }));
    }
  }, [customer]);

  const belowMin = subtotalKobo > 0 && subtotalKobo < MIN_ORDER_KOBO;

  // Ask the server for the fees on this subtotal, so the cart shows exactly
  // what the order will charge. Each result is tagged with the subtotal it
  // was fetched for, so a slow response for an old cart is never displayed.
  useEffect(() => {
    if (subtotalKobo < MIN_ORDER_KOBO) {
      setFees(null);
      return undefined;
    }
    let cancelled = false;
    api.getFeeQuote(subtotalKobo)
      .then((f) => { if (!cancelled) setFees({ ...f, forSubtotal: subtotalKobo }); })
      .catch(() => { if (!cancelled) setFees(null); });
    return () => { cancelled = true; };
  }, [subtotalKobo]);

  const feesReady = fees && fees.forSubtotal === subtotalKobo;
  const totalKobo = feesReady
    ? subtotalKobo + fees.serviceFeeKobo + fees.deliveryFeeKobo + fees.takeawayFeeKobo
    : null;

  function handleClearAll() {
    if (window.confirm('Remove all items from your cart?')) clearCart();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (items.length === 0) return setError('Your cart is empty.');
    if (belowMin) return setError(`Minimum order is ${formatNaira(MIN_ORDER_KOBO)}.`);
    if (!form.fullName || !form.phone || !form.hostel) return setError('Please fill in your name, phone number and hostel.');

    setSubmitting(true);
    try {
      const payload = {
        customer: form,
        items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
      };
      const result = await api.createOrder(payload);
      if (result.checkoutUrl) {
        sessionStorage.setItem('ce_last_order', JSON.stringify({ id: result.orderId, phone: form.phone }));
        window.location.href = result.checkoutUrl;
      } else {
        clearCart();
        navigate(`/track/${result.orderId}?phone=${encodeURIComponent(form.phone)}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="checkout-page">
      <h1>Your order</h1>

      {shopName && (
        <p className="note" style={{ marginBottom: '1rem', fontWeight: 700 }}>
          Ordering from: {shopName}
        </p>
      )}

      {customer ? (
        <p className="note" style={{ marginBottom: '1rem' }}>
          Logged in as {customer.full_name || customer.phone} — details filled in below, change anything that's out of date.
        </p>
      ) : (
        <p className="note" style={{ marginBottom: '1rem' }}>
          <Link to="/login">Log in</Link> to skip typing your details next time.
        </p>
      )}

      {items.length === 0 ? (
        <p className="state-msg">Your cart is empty — go back to the menu to add something.</p>
      ) : (
        <ul className="cart-list">
          {items.map((i) => (
            <li key={i.product.id} className="cart-row">
              <span className="cart-name">{i.product.name}</span>
              <div className="qty-control">
                <button type="button" onClick={() => updateQuantity(i.product.id, i.quantity - 1)}>−</button>
                <span>{i.quantity}</span>
                <button type="button" onClick={() => updateQuantity(i.product.id, i.quantity + 1)}>+</button>
              </div>
              <span className="cart-line-total">{formatNaira(i.product.price_kobo * i.quantity)}</span>
              <button
                type="button"
                onClick={() => updateQuantity(i.product.id, 0)}
                aria-label={`Remove ${i.product.name} from cart`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, color: 'var(--error)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.3rem' }}>delete</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <button
          type="button"
          onClick={handleClearAll}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontWeight: 700, padding: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>delete_sweep</span>
          Clear cart
        </button>
      )}

      <div className="totals">
        <div className="totals-row"><span>Subtotal</span><span>{formatNaira(subtotalKobo)}</span></div>

        {feesReady && (
          <>
            <div className="totals-row"><span>Service fee</span><span>{formatNaira(fees.serviceFeeKobo)}</span></div>
            <div className="totals-row"><span>Delivery fee</span><span>{formatNaira(fees.deliveryFeeKobo)}</span></div>
            <div className="totals-row"><span>Takeaway fee</span><span>{formatNaira(fees.takeawayFeeKobo)}</span></div>
            <div className="totals-row" style={{ fontWeight: 700 }}>
              <span>Total</span><span>{formatNaira(totalKobo)}</span>
            </div>
          </>
        )}

        {!feesReady && subtotalKobo >= MIN_ORDER_KOBO && (
          <p className="totals-note">Calculating fees…</p>
        )}
        {!feesReady && subtotalKobo < MIN_ORDER_KOBO && items.length > 0 && (
          <p className="totals-note">Service, delivery and takeaway fees are added once you reach the minimum order.</p>
        )}
        {belowMin && <p className="state-msg error">Minimum order is {formatNaira(MIN_ORDER_KOBO)}.</p>}
      </div>

      <form onSubmit={handleSubmit} className="checkout-form">
        <label>Full name
          <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
        </label>
        <label>Phone number
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="2348012345678" required />
        </label>
        <label>Hostel / block
          <input value={form.hostel} onChange={(e) => setForm({ ...form, hostel: e.target.value })} required />
        </label>
        <label>Room number or gate landmark
          <input value={form.roomOrGate} onChange={(e) => setForm({ ...form, roomOrGate: e.target.value })} />
        </label>

        {error && <p className="state-msg error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={submitting || items.length === 0}>
          {submitting
            ? 'Redirecting to payment…'
            : feesReady
              ? `Pay ${formatNaira(totalKobo)} with Monnify`
              : 'Pay with Monnify'}
        </button>
      </form>
    </div>
  );
}