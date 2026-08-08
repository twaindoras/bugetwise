# BudgetWise

A personal finance web app: users sign up, log income/expense transactions, and see a real-time breakdown of spending by category — backed by a Postgres database with per-user row-level security.

**Live demo:** https://bugetwise.vercel.app

## What's real vs. illustrative

The landing page includes an illustrated product-tour widget ("Try the app live") showing what the full product experience is designed to look like — that section uses static sample data and is not wired to a backend.

The **"My Budget" section**, further down the same page, is the real, functional part of the app:
- Requires a real account (Supabase Auth)
- Reads and writes to a `transactions` table scoped to the logged-in user via Postgres Row Level Security
- Add a transaction → it's inserted into the database and the income/spent/saved totals and category breakdown recompute from real data
- Delete a transaction → removed from the database, UI updates

## Tech stack

- **Frontend:** Vanilla JavaScript, HTML, CSS — no framework/build step
- **Auth & database:** [Supabase](https://supabase.com) (Postgres + Auth + Row Level Security)
- **Payments:** [Paystack](https://paystack.com) (checkout for Pro/Annual plans and one-time add-ons)
- **Hosting:** Vercel

## Project structure

```
.
├── index.html            # markup for landing page + My Budget panel
├── app.js                # auth, transaction CRUD wiring, checkout, UI logic
├── budget-utils.js        # pure functions (transaction math) — unit tested
├── styles.css            # styling
├── tests/
│   └── budget-utils.test.js
├── supabase/
│   └── migration.sql     # transactions table + RLS policies
└── vercel.json
```

## Running locally

1. Clone the repo and open the folder.
2. Create a free [Supabase](https://supabase.com) project.
3. In the Supabase SQL Editor, run `supabase/migration.sql` to create the `transactions` table and its Row Level Security policies.
4. In `index.html`, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the `window.__env` block to your project's values (Project Settings → API).
5. (Optional) Set `PAYSTACK_PUBLIC_KEY` to a Paystack test key if you want to try the checkout flow.
6. Serve the folder with any static file server, e.g.:
   ```bash
   npx serve .
   ```
7. Open the page, create an account, and add a transaction — the numbers in "My Budget" will update from real data.

## Tests

```bash
npm test
```

Runs the unit tests for `budget-utils.js` (the transaction-summarization logic) using Node's built-in test runner — no dependencies required.

## What I learned building this

This was my first time designing a full Row Level Security policy set from scratch — making sure `select`, `insert`, and `delete` were each scoped to `auth.uid() = user_id` so one user can never read or modify another user's data, even though every client talks directly to Supabase with a public anon key. I also worked through a production deployment failure caused by a deprecated Vercel routing config, and found and fixed an exposed API credential in an earlier version of this repo — which is part of why the current version keeps only public-facing keys (Paystack's publishable key, Supabase's anon key) in client code, and nothing secret.

## Known limitations

- Plaid bank-sync is stubbed in the UI (`openPlaidLink()`) but not connected to a backend — it would need a small server endpoint to create and exchange Plaid link tokens.
- No automated tests yet.
