import { useState } from 'react';
import { formatNaira } from '../api.js';
import { useCart } from '../CartContext.jsx';
import './Menu.css';

const SHOPS = [
  {
    id: 1,
    name: 'Food Affairs (Cocacola)',
    rating: 4.6,
    image: '/shop1.png',
    menu: [
      { id: 'fa-rice', category: 'Main Meals', name: 'Rice', price_kobo: 30000 },
      { id: 'fa-beans', category: 'Main Meals', name: 'Beans', price_kobo: 30000 },
      {
        id: 'fa-fufu-soup',
        category: 'Main Meals',
        name: 'Fufu & Soup',
        description: 'With any swallow',
        price_kobo: 120000,
      },
      { id: 'fa-spag', category: 'Main Meals', name: 'Spag', priceLabel: 'From ₦200' },
      { id: 'fa-meat', category: 'Sides', name: 'Meat', price_kobo: 30000 },
      { id: 'fa-egg', category: 'Sides', name: 'Egg', price_kobo: 30000 },
      { id: 'fa-pomo', category: 'Sides', name: 'Pomo', price_kobo: 20000 },
      { id: 'fa-plantain', category: 'Sides', name: 'Plantain', priceLabel: 'From ₦100' },
    ],
  },

  {
    id: 2,
    name: 'Fuck "U" Spag',
    rating: 4.3,
    image: '/shop2.png',
    menu: [
      {
        id: 'fus-basic',
        category: 'Spaghetti Meals',
        name: 'Spag + Fish + Takeaway',
        price_kobo: 120000,
      },
      {
        id: 'fus-fish-egg',
        category: 'Spaghetti Meals',
        name: 'Spag + Fish + Egg',
        price_kobo: 150000,
      },
      {
        id: 'fus-plantain-fish-egg',
        category: 'Spaghetti Meals',
        name: 'Spag + Plantain + Fish + Egg',
        price_kobo: 170000,
      },
      {
        id: 'fus-chicken-spag',
        category: 'Spaghetti Meals',
        name: 'Chicken + Spag',
        description: 'With takeaway',
        price_kobo: 270000,
      },
      {
        id: 'fus-turkey-spag',
        category: 'Spaghetti Meals',
        name: 'Turkey + Spag',
        description: 'With takeaway',
        price_kobo: 400000,
      },
      {
        id: 'fus-spag-ala',
        category: 'Extras',
        name: 'Spag Ala',
        price_kobo: 70000,
      },
      {
        id: 'fus-extra-spag',
        category: 'Extras',
        name: 'Extra Spag',
        price_kobo: 50000,
      },
      {
        id: 'fus-plantain',
        category: 'Extras',
        name: 'Plantain',
        description: '5 pieces',
        price_kobo: 20000,
      },
      {
        id: 'fus-sausage',
        category: 'Extras',
        name: 'Sausage',
        price_kobo: 80000,
      },
      {
        id: 'fus-fish',
        category: 'Extras',
        name: 'Fish',
        priceLabel: '₦500–₦600',
      },
      {
        id: 'fus-egg',
        category: 'Extras',
        name: 'Egg',
        price_kobo: 30000,
      },
    ],
  },

  {
    id: 3,
    name: 'Precious Royal Catering (Barwa)',
    rating: 4.8,
    image: '/shop3.png',
    menu: [
      { id: 'prc-fufu', category: 'Swallows', name: 'Fufu', price_kobo: 30000 },
      { id: 'prc-eba', category: 'Swallows', name: 'EBA', price_kobo: 20000 },
      { id: 'prc-semo', category: 'Swallows', name: 'Semo', price_kobo: 30000 },
      {
        id: 'prc-pounded-yam',
        category: 'Swallows',
        name: 'Pounded Yam',
        price_kobo: 50000,
      },
      {
        id: 'prc-fish',
        category: 'Proteins',
        name: 'Fish',
        priceLabel: '₦300–₦500',
      },
      {
        id: 'prc-meat',
        category: 'Proteins',
        name: 'Meat',
        priceLabel: '₦200–₦500',
      },
      { id: 'prc-pomo', category: 'Sides', name: 'Pomo', price_kobo: 20000 },
      {
        id: 'prc-beans',
        category: 'Main Meals',
        name: 'Beans',
        description: 'Per portion',
        price_kobo: 30000,
      },
      {
        id: 'prc-rice',
        category: 'Main Meals',
        name: 'Rice',
        description: 'Per portion',
        price_kobo: 30000,
      },
      { id: 'prc-egg', category: 'Sides', name: 'Egg', price_kobo: 30000 },
      {
        id: 'prc-plantain',
        category: 'Sides',
        name: 'Plantain',
        description: '5 pieces',
        price_kobo: 20000,
      },
      {
        id: 'prc-spaghetti',
        category: 'Main Meals',
        name: 'Spaghetti',
        description: 'Per portion',
        price_kobo: 20000,
      },
    ],
  },
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
  const [selectedShopId, setSelectedShopId] = useState(null);
  const { addItem } = useCart();

  const selectedShop = SHOPS.find((shop) => shop.id === selectedShopId);

  return (
    <div className="menu-page">
      <section className="hero">
        <p className="hero-eyebrow">
          One shop. One order. Delivered to your gate.
        </p>

        <h1 className="menu-hero">
          Order from the busiest kitchen on campus — without leaving your room.
        </h1>

        <p className="hero-sub">
          Minimum order ₦1,500 · Pay by card or transfer · We walk it to your hostel
        </p>
      </section>

      {!selectedShop && (
        <div className="shop-grid">
          {SHOPS.map((shop) => (
            <button
              key={shop.id}
              className="shop-card"
              onClick={() => setSelectedShopId(shop.id)}
            >
              <img
                src={shop.image}
                alt={shop.name}
                className="shop-image"
              />

              <h3 className="shop-name">{shop.name}</h3>

              <Stars rating={shop.rating} />
            </button>
          ))}
        </div>
      )}

      {selectedShop && (
        <div className="selected-shop-menu">
          <div className="selected-shop-header">
            <button
              className="back-button"
              onClick={() => setSelectedShopId(null)}
            >
              ← Back to shops
            </button>

            <div>
              <h2>{selectedShop.name}</h2>
              <Stars rating={selectedShop.rating} />
            </div>
          </div>

          {Object.entries(
            selectedShop.menu.reduce((acc, item) => {
              (acc[item.category] = acc[item.category] || []).push(item);
              return acc;
            }, {})
          ).map(([category, items]) => (
            <section key={category} className="menu-section">
              <h2>{category}</h2>

              <div className="product-grid">
                {items.map((item) => {
                  const hasFixedPrice =
                    typeof item.price_kobo === 'number';

                  return (
                    <div key={item.id} className="product-card">
                      <div className="product-info">
                        <h3>{item.name}</h3>

                        {item.description && (
                          <p className="product-desc">
                            {item.description}
                          </p>
                        )}

                        <span className="price">
                          {hasFixedPrice
                            ? formatNaira(item.price_kobo)
                            : item.priceLabel}
                        </span>
                      </div>

                      <button
                        className="btn-add"
                        disabled={!hasFixedPrice}
                        onClick={() => {
                          if (hasFixedPrice) {
                            addItem({
                              ...item,
                              shopId: selectedShop.id,
                              shopName: selectedShop.name,
                            });
                          }
                        }}
                      >
                        {hasFixedPrice ? 'Add' : 'Select'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}