-- Campus Eats V1 schema. Money is stored in kobo (integer) everywhere.

CREATE TABLE customers (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(120) NOT NULL,
  phone         VARCHAR(20) NOT NULL UNIQUE,      -- WhatsApp number, e.g. 2348012345678
  hostel        VARCHAR(120),
  room_or_gate  VARCHAR(120),                     -- room number / gate / landmark
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'admin', -- admin | helper
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  category        VARCHAR(60) NOT NULL,           -- e.g. 'Rice', 'Swallow', 'Protein', 'Drinks'
  description     TEXT,
  price_kobo      INTEGER NOT NULL CHECK (price_kobo >= 0),
  image_url       TEXT,
  is_available    BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fee_rules (
  id                 SERIAL PRIMARY KEY,
  min_subtotal_kobo  INTEGER NOT NULL,
  max_subtotal_kobo  INTEGER,                     -- NULL = no upper bound
  service_fee_kobo   INTEGER NOT NULL,
  delivery_fee_kobo  INTEGER NOT NULL DEFAULT 30000, -- 300 naira default
  active             BOOLEAN NOT NULL DEFAULT true
);

-- Seed the fee tiers from the business plan (amounts in kobo)
INSERT INTO fee_rules (min_subtotal_kobo, max_subtotal_kobo, service_fee_kobo, delivery_fee_kobo) VALUES
  (150000, 200000, 0,     30000),
  (200100, 350000, 10000, 30000),
  (350100, 500000, 15000, 30000),
  (500100, 700000, 20000, 30000),
  (700100, NULL,   25000, 30000);

CREATE TABLE orders (
  id                  SERIAL PRIMARY KEY,
  customer_id         INTEGER NOT NULL REFERENCES customers(id),
  status              VARCHAR(30) NOT NULL DEFAULT 'pending_payment',
  -- pending_payment | payment_confirmed | accepted | shopping | out_for_delivery | delivered | cancelled
  subtotal_kobo       INTEGER NOT NULL,
  service_fee_kobo    INTEGER NOT NULL,
  delivery_fee_kobo   INTEGER NOT NULL,
  total_kobo          INTEGER NOT NULL,
  delivery_hostel     VARCHAR(120) NOT NULL,
  delivery_note       TEXT,
  assigned_helper_id  INTEGER REFERENCES admin_users(id),
  paystack_reference  VARCHAR(100) UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id                SERIAL PRIMARY KEY,
  order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        INTEGER NOT NULL REFERENCES products(id),
  product_name      VARCHAR(120) NOT NULL,
  unit_price_kobo   INTEGER NOT NULL,
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  status            VARCHAR(20) NOT NULL DEFAULT 'ok', -- ok | unavailable | refunded
  line_total_kobo   INTEGER NOT NULL
);

CREATE TABLE payments (
  id                  SERIAL PRIMARY KEY,
  order_id            INTEGER NOT NULL REFERENCES orders(id),
  paystack_reference  VARCHAR(100) NOT NULL UNIQUE,
  amount_kobo         INTEGER NOT NULL,
  status              VARCHAR(20) NOT NULL, -- initialized | success | failed
  channel             VARCHAR(30),
  raw_payload         JSONB,
  verified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refunds (
  id             SERIAL PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES orders(id),
  order_item_id  INTEGER REFERENCES order_items(id),
  amount_kobo    INTEGER NOT NULL,
  reason         VARCHAR(120) NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  processed_by   INTEGER REFERENCES admin_users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_status_history (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status  VARCHAR(30),
  new_status  VARCHAR(30) NOT NULL,
  changed_by  INTEGER REFERENCES admin_users(id),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id           SERIAL PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  order_id     INTEGER REFERENCES orders(id),
  channel      VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
  template     VARCHAR(60) NOT NULL,
  payload      JSONB,
  status       VARCHAR(20) NOT NULL DEFAULT 'queued',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_payments_order ON payments(order_id);
