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
  getProducts: () => request('/products'),
  createOrder: (payload) => request('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  getOrder: (id, phone) => request(`/orders/${id}?phone=${encodeURIComponent(phone)}`),
  verifyPayment: (reference) => request(`/payments/verify/${reference}`),

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
  adminMarkUnavailable: (token, itemId) =>
    request(`/admin/order-items/${itemId}/unavailable`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
    }),
  adminGetProducts: (token) =>
    request('/admin/products', { headers: { Authorization: `Bearer ${token}` } }),
  adminUpdateProduct: (token, id, payload) =>
    request(`/admin/products/${id}`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload),
    }),
};

export function formatNaira(kobo) {
  return `₦${(kobo / 100).toLocaleString()}`;
}