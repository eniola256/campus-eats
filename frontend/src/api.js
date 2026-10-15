const BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  getShops: () => request('/shops'),
  getProducts: (shopId) => request(shopId ? `/products?shopId=${shopId}` : '/products'),
  getStoreStatus: () => request('/shops/status'),
  getFeeQuote: (subtotalKobo) => request(`/orders/quote?subtotal=${subtotalKobo}`),
  createOrder: (payload) => request('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  getOrder: (id, phone) => request(`/orders/${id}?phone=${encodeURIComponent(phone)}`),
  getMyOrders: (sessionToken) =>
    request('/orders/mine', { headers: { Authorization: `Bearer ${sessionToken}` } }),
  verifyPayment: (reference) => request(`/payments/verify/${reference}`),

  authSignup: (fullName, phone, password) =>
    request('/auth/signup', { method: 'POST', body: JSON.stringify({ fullName, phone, password }) }),
  authLogin: (phone, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) }),
  authStatus: (loginToken) => request(`/auth/status/${loginToken}`),
  authMe: (sessionToken) =>
    request('/auth/me', { headers: { Authorization: `Bearer ${sessionToken}` } }),
  authLogout: (sessionToken) =>
    request('/auth/logout', { method: 'DELETE', headers: { Authorization: `Bearer ${sessionToken}` } }),
  authForgotPassword: (phone, newPassword) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ phone, newPassword }) }),

  adminLogin: (email, password) =>
    request('/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  adminGetOrders: (token, status) =>
    request(`/admin/orders${status ? `?status=${status}` : ''}`, { headers: { Authorization: `Bearer ${token}` } }),
  adminGetOrder: (token, id) =>
    request(`/admin/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
  adminSetStatus: (token, id, status) =>
    request(`/admin/orders/${id}/status`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }),
    }),
  adminGetHistory: (token, { from, to, status }) => {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    if (status) query.set('status', status);
    return request(`/admin/history?${query.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
  },
  adminSetStore: (token, open, message) =>
    request('/admin/store', {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ open, message }),
    }),
  adminCancelOrder: (token, id) =>
    request(`/admin/orders/${id}/cancel`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
    }),
  adminContactCustomer: (token, itemId) =>
    request(`/admin/order-items/${itemId}/contact`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
    }),
  adminMarkUnavailable: (token, itemId) =>
    request(`/admin/order-items/${itemId}/unavailable`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
    }),
  adminGetRefunds: (token, status) =>
    request(`/admin/refunds${status ? `?status=${status}` : ''}`, { headers: { Authorization: `Bearer ${token}` } }),
  adminMarkRefunded: (token, refundId) =>
    request(`/admin/refunds/${refundId}/mark-refunded`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
    }),
  adminGetShops: (token) =>
    request('/admin/shops', { headers: { Authorization: `Bearer ${token}` } }),
  adminCreateShop: (token, payload) =>
    request('/admin/shops', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload),
    }),
  adminUpdateShop: (token, id, payload) =>
    request(`/admin/shops/${id}`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload),
    }),
  adminGetProducts: (token, shopId) =>
    request(`/admin/products${shopId ? `?shopId=${shopId}` : ''}`, { headers: { Authorization: `Bearer ${token}` } }),
  adminCreateProduct: (token, payload) =>
    request('/admin/products', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload),
    }),
  adminUpdateProduct: (token, id, payload) =>
    request(`/admin/products/${id}`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload),
    }),
};

export function formatNaira(kobo) {
  return `₦${(kobo / 100).toLocaleString()}`;
}