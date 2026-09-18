# Tindahan POS — web app

React + TypeScript + Vite implementation of the design handoff in `../design_handoff_pos_inventory_system`
(built from `POS Inventory System v2.dc.html`, POS checkout **Variant A: cart left, product grid right**).

This is the **front end only**, running on in-memory sample data. There is no API, database,
service worker or offline queue yet — those belong to the next step (NestJS/Laravel + PostgreSQL per the spec).
Refreshing the page resets the data.

## Run it

Requires Node.js 18+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pricing, VAT, costing, lookup, reconciliation, lockout unit tests
npm run build      # type-check + production build into dist/
```

Demo sign-in: any username with a 4–6 digit PIN (a shorter PIN counts as a failed attempt; 5 failures shows the lockout).
Manager override accepts any 4–6 digit PIN. Keyboard: **F5** discount, **F9** void, **F12** pay, **Esc** back to cart.

To show the requirement IDs (`FR-POS-03`, `7.1` …) for spec review, copy `.env.example` to `.env.local` and set
`VITE_SHOW_SPEC_REFS=true`. Keep it `false` in production.

## Routes

| Route | Screen |
| --- | --- |
| `/login` | Sign in + open shift (float required before selling) |
| `/pos` | POS checkout, Variant A |
| `/pos/pay` | Payment, change, receipt preview, post sale |
| `/pos/returns` | Return and refund against an original receipt |
| `/shift/close` | Blind count, reconciliation, Z-report |
| `/admin` | Manager dashboard |
| `/admin/inventory` | Product catalog |
| `/admin/inventory/count` | Physical count session (frozen sheet → variance review → manager approval) |
| `/admin/inventory/:sku` | Stock card (movement history) |
| `/admin/inventory/:sku/adjust` | Manual stock adjustment (reason code + manager approval) |
| `/admin/purchasing` | PO and goods receipt with moving-average cost |
| `/admin/reports` | Four data-driven reports, CSV export |
| `/admin/maintenance` | Items, users & roles, store settings, terminals & suppliers, backup & audit |

## Layout

```
src/
  domain/      pure business rules + tests (money, pricing/VAT, costing, inventory, shift, auth)
  data/        sample catalog and back-office fixtures — replace with API calls
  app/         store (cart, session, settings, catalog), theme hook, config
  components/  app shell, override modal, shared UI
  screens/pos/         terminal screens
  screens/backoffice/  back-office screens
  styles/      tokens.css (light/dark design tokens, print pins light) + app.css
```

## Notes for the backend step

- Totals follow handoff steps 1–7 in `src/domain/pricing.ts`; the transaction discount is prorated with
  largest-remainder so line shares always sum to the discount. The server must re-price on post.
- Posting a sale here only updates local state. The real call is `POST /api/v1/sales` with an
  `Idempotency-Key` (client-generated `sale_id`), handling `409 PRICE_MISMATCH` and `422 INSUFFICIENT_STOCK`.
- Lockout, role permissions and manager overrides are mirrored in the UI only; enforce them server-side.
- Returns (`src/domain/sales.ts`), physical counts and manual adjustments (`src/domain/adjustments.ts`) post through
  the same manager-PIN override used for void/discount — `OverrideModal` now branches on `state.override`
  (`'void' | 'discount' | 'adjustment' | 'count'`). The real build should require a distinct approval role per
  spec 9.2, not just any 4–6 digit PIN.
- Sales are kept in `state.sales` only for the lifetime of the session (for the returns lookup); the real API
  needs `GET /api/v1/sales/:receiptNo` and a `POST /api/v1/returns` that reverses tax and cost at the original
  values per spec 7.5.
- Still open per the handoff: receipt format / statutory SC & PWD discounts, a return *receipt* printout, and a
  formal physical-count counting sheet workflow beyond this single-session sheet. `TRANSFER_IN/OUT` movement
  chips use a new teal token pair.
- Fonts (Figtree, Geist Mono) are self-hosted via Fontsource, so terminals work without internet.
