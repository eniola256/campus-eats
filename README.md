# Campus Eats — V1

A small campus food delivery website: students order from one shop, pay
upfront on Paystack, you (or a friend) buy and deliver, and WhatsApp keeps
everyone updated. This is a working V1 build of the plan you wrote up —
customer ordering site, order tracking, and an admin dashboard.

## What's inside

```
campus-eats/
├── backend/     Node.js + Express API, PostgreSQL, Paystack, WhatsApp
└── frontend/    React + Vite customer site and admin dashboard
```

## How the pieces fit together

- **Customer site** (`frontend`): browse the menu → cart → checkout form →
  redirected to Paystack → redirected back to an order tracking page.
- **Backend** (`backend`): stores everything in Postgres (money in kobo),
  creates the Paystack transaction, verifies payment two ways (the redirect
  AND a webhook, so a closed browser tab can't lose an order), and sends
  WhatsApp updates at each step.
- **Admin dashboard**: log in, see the order queue, move orders through
  Accepted → Shopping → Out for delivery → Delivered, and mark an item
  unavailable (which auto-refunds just that item and messages the customer).

## Setting it up

### 1. Database
You need a PostgreSQL database (a free one on [Neon](https://neon.tech) or
[Supabase](https://supabase.com) works fine to start).

```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, Paystack keys
npm install
npm run migrate             # creates all tables
npm run seed                # loads a starter menu (edit src/db/seed.sql first!)
npm run create-admin -- "Your Name" you@example.com yourPassword
npm run dev                 # starts the API on http://localhost:4000
```

### 2. Paystack
- Create a free account at [paystack.com](https://paystack.com), grab your
  **test** secret/public keys from Settings → API Keys, put them in
  `backend/.env`.
- In the Paystack dashboard, add a webhook URL:
  `https://your-deployed-backend.com/api/payments/webhook` (Paystack needs a
  public HTTPS URL — this won't work with `localhost` until you deploy or
  use a tunnel like ngrok for testing).
- Start with test mode and test cards before going live.

### 3. WhatsApp
- Create a Meta developer app and set up the **WhatsApp Business Platform**
  (Cloud API). You'll get a temporary access token and a phone number ID.
- Put `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` in `.env`.
- Until those are set, the backend just logs the message it *would* have
  sent (`[whatsapp:dry-run]`) — so you can build and test everything else
  first without a WhatsApp Business account.

### 4. Frontend

```bash
cd frontend
cp .env.example .env        # VITE_API_BASE=/api is fine for local dev
npm install
npm run dev                 # opens http://localhost:5173
```

The dev server proxies `/api` to `http://localhost:4000`, so both need to be
running at once.

### 5. Try it end to end
1. Open the site, add items past the ₦1,500 minimum, check out.
2. Pay with a [Paystack test card](https://paystack.com/docs/payments/test-payments/).
3. You'll land back on an order tracking page.
4. Open `/admin`, log in, and walk the order through its statuses — watch
   the tracking page update (it polls every 8 seconds).
5. Try "mark unavailable" on one item — it refunds that item and the
   tracking page shows it struck through.

## Deploying

- **Backend**: Render, Railway, or Fly.io all work well for a small Node +
  Postgres app. Set the same environment variables as `.env`.
- **Frontend**: Vercel or Netlify — set `VITE_API_BASE` to your deployed
  backend's URL (e.g. `https://api.yourdomain.com/api`).
- Point your domain, update `FRONTEND_URL` in the backend `.env` so
  Paystack's redirect and CORS both work, and switch Paystack to live keys
  once you've tested with test keys.

## Things worth knowing before you launch

- **Money is stored in kobo** everywhere in the database, matching Paystack's
  own API — don't accidentally multiply/divide by 100 twice.
- **Payment is verified twice**: once when the customer's browser redirects
  back (fast, but unreliable if they close the tab), and once via the
  Paystack webhook (slower, but guaranteed). Both call the same
  duplicate-safe function, so you can't double-charge or double-confirm.
- **No substitutions in V1** — matches your plan. Marking an item
  unavailable always refunds just that item and keeps the rest of the order
  going.
- **Pausing ordering**: `PATCH /api/admin/ordering/pause` (and `/resume`)
  toggles every product's availability — a quick way to stop new orders if
  the shop is overwhelmed, without touching the website itself.
- **Menu content**: edit `backend/src/db/seed.sql` with the real shop's
  actual items and prices before you seed the database — what's there now
  is placeholder data to get you running.
- **Fee tiers**: seeded in `fee_rules` exactly as your pricing table
  specified. Change them any time via SQL — no code changes needed — so you
  can adjust once you see real customer behavior, as you planned.
