import { useEffect, useState } from 'react';
import { api, formatNaira } from '../api.js';
import { useCart } from '../CartContext.jsx';

export default function Menu() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addItem } = useCart();

  useEffect(() => {
    api.getProducts()
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="state-msg">Loading the menu…</p>;
  if (error) return <p className="state-msg error">Couldn't load the menu: {error}</p>;

  const byCategory = products.reduce((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  return (
    <div className="menu-page">
      <section className="hero">
        <p className="hero-eyebrow">One shop. One order. Delivered to your gate.</p>
        <h1>Order from the busiest kitchen on campus — without leaving your room.</h1>
        <p className="hero-sub">Minimum order ₦1,500 · Pay by card or transfer · We walk it to your hostel</p>
      </section>

      {Object.entries(byCategory).map(([category, items]) => (
        <section key={category} className="menu-section">
          <h2>{category}</h2>
          <div className="product-grid">
            {items.map((p) => (
              <div key={p.id} className="product-card">
                <div className="product-info">
                  <h3>{p.name}</h3>
                  {p.description && <p className="product-desc">{p.description}</p>}
                  <span className="price">{formatNaira(p.price_kobo)}</span>
                </div>
                <button className="btn-add" onClick={() => addItem(p)}>Add</button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
