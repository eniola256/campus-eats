-- Sample menu for the first shop. Adjust names/prices to match the real shop.
INSERT INTO products (name, category, description, price_kobo, is_available, sort_order) VALUES
  ('Jollof Rice',        'Rice',     'Party-style jollof rice',              100000, true, 1),
  ('Fried Rice',         'Rice',     'Fried rice with mixed veg',            100000, true, 2),
  ('White Rice & Stew',  'Rice',     'White rice with tomato stew',           90000, true, 3),
  ('Amala & Ewedu',      'Swallow',  'Amala with ewedu and gbegiri',         120000, true, 4),
  ('Pounded Yam & Egusi','Swallow',  'Pounded yam with egusi soup',          150000, true, 5),
  ('Grilled Chicken',    'Protein',  'Half grilled chicken',                150000, true, 6),
  ('Fried Fish',         'Protein',  'One piece fried fish',                 100000, true, 7),
  ('Beef (2 pieces)',    'Protein',  'Two pieces of beef',                    80000, true, 8),
  ('Fried Plantain',     'Sides',    'Sweet fried plantain',                 50000, true, 9),
  ('Coleslaw',           'Sides',    'Fresh coleslaw',                       40000, true, 10),
  ('Coke (35cl)',        'Drinks',   'Chilled soft drink',                   35000, true, 11),
  ('Bottled Water',      'Drinks',   '75cl bottled water',                   25000, true, 12);

-- NOTE: admin_users is intentionally NOT seeded here with a hardcoded password
-- hash. Run `node scripts/create-admin.js` after migrating to create your
-- first admin login with a real bcrypt hash of a password you choose.
