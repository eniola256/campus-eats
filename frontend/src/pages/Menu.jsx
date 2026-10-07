import { useEffect, useState } from 'react';
import { api, formatNaira } from '../api.js';
import { useCart } from '../CartContext.jsx';
import './Menu.css';

function Stars({ rating }) {
  if (rating == null) return null;
  const full = Math.round(rating);
  return (
    <span className="shop-stars">
      {'★'.repeat(full)}
      {'☆'.repeat(5 - full)}
      <span className="shop-rating-number">{Number(rating).toFixed(1)}</span>
    </span>
  );
}

function ProductQty({ product, shopName }) {
  const { items: cartItems, addItem, switchShopAndAdd, updateQuantity } = useCart();
  const cartItem = cartItems.find((i) => i.product.id === product.id);
  const qty = cartItem ? cartItem.quantity : 0;

  function handleAdd() {
    const withShop = { ...product, shopName };
    const added = addItem(withShop);
    if (!added) {
      const currentShop = cartItems[0]?.product.shopName || 'a different shop';
      const confirmed = window.confirm(
        `Your cart has items from ${currentShop}. Adding this will clear it and start a new order from ${shopName}. Continue?`
      );
      if (confirmed) switchShopAndAdd(withShop);
    }
  }

  if (qty === 0) {
    return (
      <div className="menu-qty-control">
        <button disabled>−</button>
        <span>0</span>
        <button onClick={handleAdd}>+</button>
      </div>
    );
  }

  return (
    <div className="menu-qty-control">
      <button onClick={() => updateQuantity(product.id, qty - 1)}>−</button>
      <span>{qty}</span>
      <button onClick={() => updateQuantity(product.id, qty + 1)}>+</button>
    </div>
  );
}

export default function Menu() {
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [shopsError, setShopsError] = useState(null);

  const [selectedShop, setSelectedShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState(null);

  useEffect(() => {
    api.getShops()
      .then((result) => setShops(Array.isArray(result) ? result : []))
      .catch((e) => setShopsError(e.message))
      .finally(() => setShopsLoading(false));
  }, []);

  function openShop(shop) {
    setSelectedShop(shop);
    setProducts([]);
    setProductsError(null);
    setProductsLoading(true);
    api.getProducts(shop.id)
      .then((result) => setProducts(Array.isArray(result) ? result : []))
      .catch((e) => setProductsError(e.message))
      .finally(() => setProductsLoading(false));
  }

  function backToShops() {
    setSelectedShop(null);
    setProducts([]);
  }

  const byCategory = products.reduce((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  return (
    <div className="menu-page">
      <section className="hero">
        <p className="hero-eyebrow">One shop. One order. Delivered to your gate.</p>
        <h1 className="menu-hero">Order from the busiest kitchen on campus — without leaving your room.</h1>
        <p className="hero-sub">Minimum order ₦1,500 · Pay by card or transfer · We walk it to your hostel</p>
      </section>

      {!selectedShop && (
        <>
          {shopsLoading && <p className="state-msg">Loading shops…</p>}
          {shopsError && <p className="state-msg error">Couldn't load shops: {shopsError}</p>}

          {!shopsLoading && !shopsError && (
            <div className="shop-grid">
              {shops.map((shop) => (
                <button key={shop.id} className="shop-card" onClick={() => openShop(shop)}>
                  <img src={shop.image_url} alt={shop.name} className="shop-image" />
                  <h3 className="shop-name">{shop.name}</h3>
                  <Stars rating={shop.rating} />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {selectedShop && (
        <div className="selected-shop-menu">
          <div className="selected-shop-header">
            <button className="back-button" onClick={backToShops}>← Back to shops</button>
            <div>
              <h2>{selectedShop.name}</h2>
              <Stars rating={selectedShop.rating} />
            </div>
          </div>

          {productsLoading && <p className="state-msg">Loading menu…</p>}
          {productsError && <p className="state-msg error">Couldn't load menu: {productsError}</p>}

          {!productsLoading && !productsError && Object.entries(byCategory).map(([category, items]) => (
            <section key={category} className="menu-section">
              <h2>{category}</h2>
              <div className="product-grid">
                {items.map((p) => (
                  <div key={p.id} className="product-card">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="product-image" />
                    ) : (
                      <div className="product-image-placeholder">🍽️</div>
                    )}
                    <div className="product-info">
                      <h3>{p.name}</h3>
                      {p.description && <p className="product-desc">{p.description}</p>}
                      <span className="price">{formatNaira(p.price_kobo)}</span>
                    </div>
                    <div className="product-actions">
                      <ProductQty product={p} shopName={selectedShop.name} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}