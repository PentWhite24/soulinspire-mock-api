# Soulinspire Mock API

A stand-in for the Soulinspire API that serves **dummy data from memory**. It has the same endpoints, request bodies, response shapes and error formats as the real API (`soulinspire-api`), so the storefront (`soulinspire-web`) works against it unchanged.

Use it to build and test the frontend without a database, a Paystack account or the real backend.

- No database: everything lives in memory and resets on restart.
- No real payments: card payments always succeed (or can be made to fail on purpose).
- Starts with 12 products and 10 sample orders.
- Accepts requests from any website, so any local port or preview host works.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm start          # http://localhost:4000/api
npm run dev        # same, restarts when files change
npm test           # 12 tests
```

Then point the storefront at it. In `soulinspire-web/.env.development`:

```
VITE_API_URL=http://localhost:4000/api
```

That's the storefront's default already, so `npm run dev` in both projects is enough. Run either the mock or the real API on port 4000, not both.

## Settings (optional)

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `4000` | Port to listen on |
| `FRONTEND_URL` | `http://localhost:5173` | Where card payments "return" to |
| `ADMIN_API_KEY` | `mock-admin-key` | Key for the admin endpoints |
| `MOCK_DELAY_MS` | `0` | Wait this long before every response, to see loading states |

Example: `MOCK_DELAY_MS=800 PORT=4100 npm start`

## Dummy data

| What | Where | Notes |
| --- | --- | --- |
| Products | `src/data/catalog.js` | Journals, candles, apparel, wellness, gifts. Prices in Naira. |
| Sample orders | `src/data/sample-orders.js` | 10 orders, `SI-MOCK0001` to `SI-MOCK0010`, one or more in every status |
| Delivery, VAT, promo codes | `src/pricing.js` | Same rules as the real API. Promo code: `SOUL10` (10% off) |
| Bank details | `src/app.js` | Mock Bank · Soulinspire Ltd · 0123456789 |

Customers in the sample orders are fictional and use `@example.com` addresses.

## Testing tricks

| To test | Do this |
| --- | --- |
| Loading spinners | Add `?_delay=2000` to any request, or set `MOCK_DELAY_MS` |
| Error screens | Send header `X-Mock-Status: 500` (any 400–599 code) |
| A declined card | Call `/api/payments/verify/<reference>-decline`; the order stays unpaid |
| Out of stock | Order 4 or more of `tea-calm` (only 3 in stock) |
| Missing size | Order `tee-soulwork` or `hoodie-grace` without a `size` |
| Validation errors | Send a bad phone or email to `POST /api/orders` |
| Start over | `POST /api/__mock/reset`, or restart |

## Endpoints

All responses are JSON. Errors look like `{ "error": { "code", "message", "fields"?, "details"? } }`.

### Shop

| Method & path | Returns |
| --- | --- |
| `GET /api/health` | `{ ok, payments: "mock", mock: true }` |
| `GET /api/products?q=&category=&sort=` | `{ products }`. `sort`: `featured`, `new`, `low`, `high` |
| `GET /api/products/:id` | `{ product }` |
| `GET /api/categories` | `{ categories }` |
| `GET /api/config` | Delivery zones and fees, VAT rate, free-delivery threshold, pickup point |
| `POST /api/promo/validate` | `{ code }` → `{ promo }`, or 404 |
| `POST /api/orders/quote` | `{ items, delivery, promoCode }` → `{ items, promo, totals }` |
| `POST /api/orders` | `{ order, payment }` (below) |
| `GET /api/orders/:orderNo?email=` | `{ order }`; the email must match |
| `GET /api/payments/verify/:reference` | `{ paid, order }`; marks a card order paid |
| `POST /api/payments/webhook` | 200. Marks paid on `charge.success`; no signature check |

`POST /api/orders` body:

```json
{
  "customer": { "name": "Ada Obi", "phone": "0803 123 4567", "email": "ada@example.com" },
  "delivery": { "method": "std", "zone": "lagos", "address": "12 Admiralty Way", "city": "Lekki" },
  "payment": { "method": "card" },
  "items": [{ "productId": "tee-soulwork", "size": "M", "qty": 1 }],
  "promoCode": "SOUL10"
}
```

- `payment.method: "card"` returns `payment.authorizationUrl`. It points straight back to the storefront with `?order=…&reference=…`, as if the customer had just paid.
- `"transfer"` returns `payment.bankDetails`. `"pod"` (pay on delivery) works for Lagos, Rivers and FCT only.
- An `Idempotency-Key` header makes repeat requests return the first order.
- Stock goes down when an order is placed and back up if it's cancelled.

### Admin

Send `Authorization: Bearer mock-admin-key`.

| Method & path | Returns |
| --- | --- |
| `GET /api/admin/orders?status=&limit=&offset=` | `{ orders, total }`, newest first |
| `GET /api/admin/orders/:orderNo` | `{ order }` |
| `PATCH /api/admin/orders/:orderNo` | `{ status }` → `{ order }`. Same status rules as the real API |
| `GET /api/admin/products` | `{ products }`, including hidden ones |
| `PATCH /api/admin/products/:id` | Any of `name, price, stock, badge, image, description, line, active` → `{ product }` |

```bash
curl -H "Authorization: Bearer mock-admin-key" "http://localhost:4000/api/admin/orders?status=paid"
```

### Mock only

| Method & path | Does |
| --- | --- |
| `POST /api/__mock/reset` | Puts products, stock and orders back to the starting dummy data |

## Differences from the real API

- Data isn't saved anywhere and is shared by everyone using the same running server.
- No rate limits, no security headers, any website may call it.
- Payments are never real; webhooks aren't signature-checked.
- Unpaid card orders are never cancelled automatically.
