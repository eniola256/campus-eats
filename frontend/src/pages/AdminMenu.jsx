import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatNaira } from '../api.js';

/* ---------- shared bits ---------- */

function Thumb({ path }) {
  if (!path) return <span className="admin-thumb admin-thumb-empty" />;
  // key remounts the <img> when the path changes, so an earlier load error
  // doesn't keep a corrected path hidden.
  return (
    <img
      key={path}
      className="admin-thumb"
      src={path}
      alt=""
      onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
    />
  );
}

/* ---------- shops ---------- */

const EMPTY_SHOP = { name: '', description: '', imageUrl: '', rating: '', sortOrder: '' };

function toShopForm(shop) {
  return {
    name: shop.name || '',
    description: shop.description || '',
    imageUrl: shop.image_url || '',
    rating: shop.rating ?? '',
    sortOrder: shop.sort_order ?? 0,
  };
}

// Cleared text/rating fields are sent as '' and stored as NULL by the backend.
function toShopPayload(form) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    imageUrl: form.imageUrl.trim(),
    rating: form.rating === '' ? '' : Number(form.rating),
    sortOrder: form.sortOrder === '' ? 0 : Number(form.sortOrder),
  };
}

function ShopFields({ form, setForm }) {
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  return (
    <div className="admin-form">
      <label className="admin-field">Name
        <input type="text" value={form.name} onChange={set('name')} required />
      </label>
      <label className="admin-field">Image path
        <input type="text" value={form.imageUrl} onChange={set('imageUrl')} placeholder="/shop1.png" />
      </label>
      <label className="admin-field">Rating (0–5)
        <input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={set('rating')} />
      </label>
      <label className="admin-field">Sort order (smaller shows first)
        <input type="number" step="1" value={form.sortOrder} onChange={set('sortOrder')} />
      </label>
      <label className="admin-field admin-field-wide">Description
        <textarea rows="2" value={form.description} onChange={set('description')} />
      </label>
    </div>
  );
}

function ShopCard({ shop, token, onSaved }) {
  const [form, setForm] = useState(() => toShopForm(shop));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(toShopForm(shop));

  async function save() {
    if (!form.name.trim()) return setStatus({ type: 'error', text: 'Shop name is required.' });
    setSaving(true);
    setStatus(null);
    try {
      const updated = await api.adminUpdateShop(token, shop.id, toShopPayload(form));
      setForm(toShopForm(updated));
      onSaved(updated);
      setStatus({ type: 'ok', text: 'Saved' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  // Applies immediately, without touching any unsaved edits in the form.
  async function toggleActive(e) {
    setStatus(null);
    try {
      const updated = await api.adminUpdateShop(token, shop.id, { isActive: e.target.checked });
      onSaved(updated);
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    }
  }

  return (
    <div className={`admin-card ${shop.is_active ? '' : 'inactive'}`}>
      <div className="admin-card-head">
        <Thumb path={form.imageUrl.trim()} />
        <strong>{shop.name}</strong>
        {!shop.is_active && <span className="tag">hidden</span>}
      </div>

      <ShopFields form={form} setForm={setForm} />

      <div className="admin-card-actions">
        <label className="admin-switch">
          <input type="checkbox" checked={shop.is_active} onChange={toggleActive} />
          Visible to customers
        </label>
        <button className="btn-primary" onClick={save} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {status && <span className={`admin-msg ${status.type}`}>{status.text}</span>}
      </div>
    </div>
  );
}

function AddShopForm({ token, onAdded }) {
  const [form, setForm] = useState(EMPTY_SHOP);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setStatus({ type: 'error', text: 'Shop name is required.' });
    setSaving(true);
    setStatus(null);
    try {
      await api.adminCreateShop(token, toShopPayload(form));
      setForm(EMPTY_SHOP);
      setStatus({ type: 'ok', text: 'Shop added' });
      onAdded();
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-card" onSubmit={submit}>
      <ShopFields form={form} setForm={setForm} />
      <div className="admin-card-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Adding…' : 'Add shop'}
        </button>
        {status && <span className={`admin-msg ${status.type}`}>{status.text}</span>}
      </div>
    </form>
  );
}

function ShopsTab({ token }) {
  const [shops, setShops] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setShops(await api.adminGetShops(token));
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function replaceShop(updated) {
    setShops((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  if (error) return <p className="state-msg error">{error}</p>;
  if (!shops) return <p className="state-msg">Loading…</p>;

  return (
    <>
      <h2 className="admin-section-title">Add a shop</h2>
      <AddShopForm token={token} onAdded={load} />

      <h2 className="admin-section-title">Your shops</h2>
      {shops.length === 0 && <p className="state-msg">No shops yet.</p>}
      {shops.map((shop) => (
        <ShopCard key={shop.id} shop={shop} token={token} onSaved={replaceShop} />
      ))}
    </>
  );
}

/* ---------- menu items ---------- */

const EMPTY_PRODUCT = { name: '', category: '', description: '', imageUrl: '', price: '', sortOrder: '' };

// Prices are typed in naira here and stored as kobo (×100) in the database.
function toProductForm(product) {
  return {
    name: product.name || '',
    category: product.category || '',
    description: product.description || '',
    imageUrl: product.image_url || '',
    price: product.price_kobo / 100,
    sortOrder: product.sort_order ?? 0,
  };
}

function toProductPayload(form) {
  return {
    name: form.name.trim(),
    category: form.category.trim(),
    description: form.description.trim(),
    imageUrl: form.imageUrl.trim(),
    priceKobo: Math.round(Number(form.price) * 100),
    sortOrder: form.sortOrder === '' ? 0 : Number(form.sortOrder),
  };
}

function validateProduct(form) {
  if (!form.name.trim()) return 'Item name is required.';
  if (!form.category.trim()) return 'Category is required.';
  if (form.price === '' || !Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
    return 'Enter a valid price.';
  }
  return null;
}

function ProductFields({ form, setForm }) {
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  return (
    <div className="admin-form">
      <label className="admin-field">Name
        <input type="text" value={form.name} onChange={set('name')} required />
      </label>
      <label className="admin-field">Category
        <input type="text" list="item-categories" value={form.category} onChange={set('category')} required />
      </label>
      <label className="admin-field">Price (₦)
        <input type="number" min="0" step="any" value={form.price} onChange={set('price')} required />
      </label>
      <label className="admin-field">Image path
        <input type="text" value={form.imageUrl} onChange={set('imageUrl')} placeholder="/fufu.jpg" />
      </label>
      <label className="admin-field">Sort order (within category)
        <input type="number" step="1" value={form.sortOrder} onChange={set('sortOrder')} />
      </label>
      <label className="admin-field admin-field-wide">Description
        <textarea rows="2" value={form.description} onChange={set('description')} />
      </label>
    </div>
  );
}

function ProductCard({ product, token, onSaved }) {
  const [form, setForm] = useState(() => toProductForm(product));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(toProductForm(product));

  async function save() {
    const problem = validateProduct(form);
    if (problem) return setStatus({ type: 'error', text: problem });
    setSaving(true);
    setStatus(null);
    try {
      const updated = await api.adminUpdateProduct(token, product.id, toProductPayload(form));
      setForm(toProductForm(updated));
      onSaved(updated);
      setStatus({ type: 'ok', text: 'Saved' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  // Applies immediately, without touching any unsaved edits in the form.
  async function toggleAvailable(e) {
    setStatus(null);
    try {
      const updated = await api.adminUpdateProduct(token, product.id, { isAvailable: e.target.checked });
      onSaved(updated);
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    }
  }

  return (
    <div className={`admin-card ${product.is_available ? '' : 'inactive'}`}>
      <div className="admin-card-head">
        <Thumb path={form.imageUrl.trim()} />
        <strong>{product.name}</strong>
        <span>{formatNaira(product.price_kobo)}</span>
        {!product.is_available && <span className="tag">unavailable</span>}
      </div>

      <ProductFields form={form} setForm={setForm} />

      <div className="admin-card-actions">
        <label className="admin-switch">
          <input type="checkbox" checked={product.is_available} onChange={toggleAvailable} />
          Available to order
        </label>
        <button className="btn-primary" onClick={save} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {status && <span className={`admin-msg ${status.type}`}>{status.text}</span>}
      </div>
    </div>
  );
}

function AddProductForm({ token, shopId, onAdded }) {
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const problem = validateProduct(form);
    if (problem) return setStatus({ type: 'error', text: problem });
    setSaving(true);
    setStatus(null);
    try {
      await api.adminCreateProduct(token, { ...toProductPayload(form), shopId });
      // keep the category, since new items usually go in the same one
      setForm({ ...EMPTY_PRODUCT, category: form.category });
      setStatus({ type: 'ok', text: 'Item added' });
      onAdded();
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-card" onSubmit={submit}>
      <ProductFields form={form} setForm={setForm} />
      <div className="admin-card-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Adding…' : 'Add item'}
        </button>
        {status && <span className={`admin-msg ${status.type}`}>{status.text}</span>}
      </div>
    </form>
  );
}

function ItemsTab({ token }) {
  const [shops, setShops] = useState(null);
  const [shopId, setShopId] = useState(null);
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.adminGetShops(token)
      .then((list) => {
        setShops(list);
        if (list.length > 0) setShopId(list[0].id);
      })
      .catch((err) => setError(err.message));
  }, [token]);

  // Reload whenever the selected shop changes; `cancelled` stops a slow
  // response for the previous shop from overwriting the current list.
  useEffect(() => {
    if (shopId == null) return undefined;
    let cancelled = false;
    setProducts(null);
    api.adminGetProducts(token, shopId)
      .then((list) => { if (!cancelled) setProducts(list); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [token, shopId]);

  async function reload() {
    try {
      setProducts(await api.adminGetProducts(token, shopId));
    } catch (err) {
      setError(err.message);
    }
  }

  function replaceProduct(updated) {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  if (error) return <p className="state-msg error">{error}</p>;
  if (!shops) return <p className="state-msg">Loading…</p>;
  if (shops.length === 0) return <p className="state-msg">Add a shop first, in the Shops tab.</p>;

  const categories = products ? [...new Set(products.map((p) => p.category))] : [];

  return (
    <>
      <label className="admin-field admin-shop-picker">Shop
        <select value={shopId ?? ''} onChange={(e) => setShopId(Number(e.target.value))}>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.is_active ? '' : ' (hidden)'}</option>
          ))}
        </select>
      </label>

      {/* one list shared by every category field on the page */}
      <datalist id="item-categories">
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>

      {!products ? (
        <p className="state-msg">Loading items…</p>
      ) : (
        <>
          <h2 className="admin-section-title">Add an item</h2>
          <AddProductForm token={token} shopId={shopId} onAdded={reload} />

          <h2 className="admin-section-title">Items ({products.length})</h2>
          {products.length === 0 && <p className="state-msg">No items for this shop yet.</p>}
          {products.map((product) => (
            <ProductCard key={product.id} product={product} token={token} onSaved={replaceProduct} />
          ))}
        </>
      )}
    </>
  );
}

/* ---------- page ---------- */

export default function AdminMenu() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('ce_admin_token');
  const [tab, setTab] = useState('items');

  useEffect(() => {
    if (!token) navigate('/admin');
  }, [token, navigate]);

  function logout() {
    sessionStorage.removeItem('ce_admin_token');
    navigate('/admin');
  }

  if (!token) return null;

  return (
    <div className="admin-dashboard">
      <div className="admin-topbar">
        <h1>Menu &amp; shops</h1>
        <div className="admin-topbar-actions">
          <button className="btn-secondary" onClick={() => navigate('/admin/dashboard')}>Back to orders</button>
          <button className="btn-secondary" onClick={logout}>Log out</button>
        </div>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'items' ? 'active' : ''}`} onClick={() => setTab('items')}>
          Menu items
        </button>
        <button className={`admin-tab ${tab === 'shops' ? 'active' : ''}`} onClick={() => setTab('shops')}>
          Shops
        </button>
      </div>

      {tab === 'items' ? <ItemsTab token={token} /> : <ShopsTab token={token} />}
    </div>
  );
}