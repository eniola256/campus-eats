import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../CartContext.jsx';
import { api, formatNaira } from '../api.js';

const MIN_ORDER_KOBO = 150000;

export default function Checkout() {
  const { items, updateQuantity, subtotalKobo, clearCart } = useCart();
  const [form, setForm] = useState({ fullName: '', phone: '', hostel: '', roomOrGate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const belowMin = subtotalKobo > 0 && subtotalKobo < MIN_ORDER_KOBO;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (items.length === 0) return setError('Your cart is empty.');
    if (belowMin) return setError(`Minimum order is ${formatNaira(MIN_ORDER_KOBO)}.`);
    if (!form.fullName || !form.phone || !form.hostel) return setError('Please fill in your name, WhatsApp number and hostel.');

    setSubmitting(true);
    try {
      const payload = {
        customer: form,
        items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
      };
      const result = await api.createOrder(payload);
      if (result.checkoutUrl) {
        // Store enough to find the order again once Monnify redirects back
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
            </li>
          ))}
        </ul>
      )}

      <div className="totals">
        <div className="totals-row"><span>Subtotal</span><span>{formatNaira(subtotalKobo)}</span></div>
        <p className="totals-note">Service fee and ₦300 delivery fee are calculated at payment.</p>
        {belowMin && <p className="state-msg error">Minimum order is {formatNaira(MIN_ORDER_KOBO)}.</p>}
      </div>

      <form onSubmit={handleSubmit} className="checkout-form">
        <label>Full name
          <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
        </label>
        <label>WhatsApp number
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
          {submitting ? 'Redirecting to payment…' : 'Pay with Paystack'}
        </button>
      </form>
    </div>
  );
}
