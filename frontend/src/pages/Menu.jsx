import { useEffect, useState } from 'react';
import { api, formatNaira } from '../api.js';
import { useCart } from '../CartContext.jsx';
import './Menu.css';

// Placeholder shop data — there's only one real shop wired up in the
// backend right now, so this is a mockup for the "choose a shop" flow
// until real multi-shop support exists (a shops table, products
// assigned to a shop, etc). Clicking any card just jumps to the Food
// tab, which shows the one real menu we have either way.
const SHOPS = [
  { id: 1, name: 'Yaba Deli', rating: 4.6, image: '/shop1.png' },
  { id: 2, name: 'Mama Put Kitchen', rating: 4.3, image: '/shop2.png' },
  { id: 3, name: 'Campus Grill House', rating: 4.8, image: '/shop3.png' },
];

function Stars({ rating }) {
  const full = Math.round(rating);
  return (
    <span className="shop-stars">
      {'★'.repeat(full)}
      {'☆'.repeat(5 - full)}
      <span className="shop-rating-number">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function Menu() {
  const [view, setView] = useState('shops'); // 'shops' | 'food'
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addItem } = useCart();

  useEffect(() => {
    api.getProducts()
      .then((result) => setProducts(Array.isArray(result) ? result : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const byCategory = products.reduce((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  return (
    <div className="menu-page">
      {/* Original hero — unchanged, shown above both tabs */}
      <section className="hero">
        <p className="hero-eyebrow">One shop. One order. Delivered to your gate.</p>
        <h1 className="menu-hero">Order from the busiest kitchen on campus — without leaving your room.</h1>
        <p className="hero-sub">Minimum order ₦1,500 · Pay by card or transfer · We walk it to your hostel</p>
      </section>

      <div className="menu-tabs">
        <button
          className={`menu-tab ${view === 'shops' ? 'active' : ''}`}
          onClick={() => setView('shops')}
        >
          Shops
        </button>
        <button
          className={`menu-tab ${view === 'food' ? 'active' : ''}`}
          onClick={() => setView('food')}
        >
          Food
        </button>
      </div>

      {view === 'shops' && (
        <div className="shop-grid">
          {SHOPS.map((shop) => (
            <button key={shop.id} className="shop-card" onClick={() => setView('food')}>
              <img src={shop.image} alt={shop.name} className="shop-image" />
              <h3 className="shop-name">{shop.name}</h3>
              <Stars rating={shop.rating} />
            </button>
          ))}
        </div>
      )}

      {view === 'food' && (
        <>
          {loading && <p className="state-msg">Loading the menu…</p>}
          {error && <p className="state-msg error">Couldn't load the menu: {error}</p>}

          {!loading && !error && Object.entries(byCategory).map(([category, items]) => (
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
        </>
      )}
    </div>
  );
}