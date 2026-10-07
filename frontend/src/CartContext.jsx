import { createContext, useContext, useMemo, useState, useEffect } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'ce_cart';

function loadInitialCart() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadInitialCart);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // One shop per cart — mirrors the same rule enforced server-side in
  // orders.js. Returns true if the item was added, false if the caller
  // needs to ask "clear cart and switch shops?" first.
  function addItem(product) {
    const currentShopId = items[0]?.product.shop_id;
    if (items.length > 0 && currentShopId != null && product.shop_id !== currentShopId) {
      return false;
    }
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    return true;
  }

  // Clears the cart, then adds this product — used when the customer
  // confirms they want to switch shops.
  function switchShopAndAdd(product) {
    setItems([{ product, quantity: 1 }]);
  }

  function updateQuantity(productId, quantity) {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.product.id !== productId)
        : prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
    );
  }

  function clearCart() {
    setItems([]);
  }

  const subtotalKobo = useMemo(
    () => items.reduce((sum, i) => sum + i.product.price_kobo * i.quantity, 0),
    [items]
  );

  const shopName = items[0]?.product.shopName || null;
  const shopId = items[0]?.product.shop_id ?? null;

  return (
    <CartContext.Provider value={{ items, addItem, switchShopAndAdd, updateQuantity, clearCart, subtotalKobo, shopName, shopId }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}