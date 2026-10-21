import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

let server, base, store;
const ADMIN = { Authorization: "Bearer mock-admin-key" };

before(async () => {
  const made = createApp({ log: false });
  store = made.store;
  server = made.app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());
beforeEach(() => store.reset());

async function call(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body && { "Content-Type": "application/json" }), ...headers },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

const order = (over = {}) => ({
  customer: { name: "Ada Obi", phone: "0803 123 4567", email: "Ada@Example.com" },
  delivery: { method: "std", zone: "lagos", address: "12 Admiralty Way", city: "Lekki" },
  payment: { method: "transfer" },
  items: [{ productId: "journal-rooted", qty: 2 }],
  ...over,
});

test("health says it's the mock", async () => {
  const { status, body } = await call("/health");
  assert.equal(status, 200);
  assert.equal(body.mock, true);
});

test("products: list, filter, sort, search, one", async () => {
  assert.equal((await call("/products")).body.products.length, 12);
  const apparel = await call("/products?category=apparel&sort=low");
  assert.deepEqual(apparel.body.products.map((p) => p.price), [11000, 22000, 38000]);
  assert.ok((await call("/products?q=tea")).body.products.some((p) => p.id === "tea-calm"));
  assert.equal((await call("/products/candle-still")).body.product.name, "Still Waters Soy Candle");
  assert.equal((await call("/products/nope")).status, 404);
});

test("categories and config", async () => {
  assert.equal((await call("/categories")).body.categories[0].id, "all");
  const cfg = (await call("/config")).body;
  assert.equal(cfg.vatRate, 0.075);
  assert.ok(cfg.zones.lagos);
});

test("promo codes", async () => {
  assert.equal((await call("/promo/validate", { method: "POST", body: { code: "soul10" } })).body.promo.pct, 0.1);
  assert.equal((await call("/promo/validate", { method: "POST", body: { code: "NOPE" } })).status, 404);
});

test("quote uses the same pricing as the real API", async () => {
  const { body } = await call("/orders/quote", {
    method: "POST",
    body: { items: [{ productId: "box-selfcare", qty: 1 }, { productId: "tea-calm", qty: 1 }], promoCode: "SOUL10", delivery: { zone: "rivers", method: "std" } },
  });
  assert.deepEqual(body.totals, { subtotal: 51500, discount: 5150, delivery: 3000, vat: 3476, total: 52826 });
});

test("place a transfer order; stock goes down; lookup needs the email", async () => {
  const res = await call("/orders", { method: "POST", body: order() });
  assert.equal(res.status, 201);
  assert.equal(res.body.order.status, "awaiting_transfer");
  assert.equal(res.body.order.customer.phone, "+2348031234567");
  assert.equal(res.body.payment.bankDetails.reference, res.body.order.orderNo);
  assert.equal((await call("/products/journal-rooted")).body.product.stock, 22);
  const no = res.body.order.orderNo;
  assert.equal((await call(`/orders/${no}`)).status, 404);
  assert.equal((await call(`/orders/${no}?email=ada@example.com`)).status, 200);
});

test("card order: redirect URL, then verify marks it paid", async () => {
  const res = await call("/orders", { method: "POST", body: order({ payment: { method: "card" } }) });
  assert.equal(res.body.order.status, "pending_payment");
  const ref = res.body.payment.reference;
  assert.ok(res.body.payment.authorizationUrl.includes(`reference=${ref}`));
  const declined = await call(`/payments/verify/${ref}-decline`);
  assert.equal(declined.body.paid, false);
  const ok = await call(`/payments/verify/${ref}`);
  assert.equal(ok.body.paid, true);
  assert.equal(ok.body.order.status, "paid");
});

test("errors match the real API's shape", async () => {
  const v = await call("/orders", { method: "POST", body: order({ customer: { name: "", phone: "1", email: "x" } }) });
  assert.equal(v.status, 400);
  assert.equal(v.body.error.code, "validation_failed");
  assert.ok(v.body.error.fields["customer.email"]);

  const s = await call("/orders", { method: "POST", body: order({ items: [{ productId: "tea-calm", qty: 9 }] }) });
  assert.equal(s.status, 409);
  assert.deepEqual(s.body.error.details[0], { productId: "tea-calm", reason: "insufficient_stock", available: 3 });

  const z = await call("/orders", { method: "POST", body: order({ items: [{ productId: "tee-soulwork", qty: 1 }] }) });
  assert.equal(z.body.error.details[0].reason, "size_required");
});

test("Idempotency-Key returns the same order", async () => {
  const headers = { "Idempotency-Key": "same" };
  const a = await call("/orders", { method: "POST", body: order(), headers });
  const b = await call("/orders", { method: "POST", body: order(), headers });
  assert.equal(a.status, 201);
  assert.equal(b.status, 200);
  assert.equal(a.body.order.orderNo, b.body.order.orderNo);
});

test("admin: sample orders, auth, status rules, cancel restocks, product edits", async () => {
  assert.equal((await call("/admin/orders")).status, 401);
  const list = await call("/admin/orders", { headers: ADMIN });
  assert.equal(list.body.total, 10);
  assert.equal((await call("/admin/orders?status=delivered", { headers: ADMIN })).body.total, 3);

  const placed = await call("/orders", { method: "POST", body: order() });
  const no = placed.body.order.orderNo;
  assert.equal((await call(`/admin/orders/${no}`, { method: "PATCH", headers: ADMIN, body: { status: "delivered" } })).status, 409);
  await call(`/admin/orders/${no}`, { method: "PATCH", headers: ADMIN, body: { status: "cancelled" } });
  assert.equal((await call("/products/journal-rooted")).body.product.stock, 24);

  const edit = await call("/admin/products/mug-breathe", { method: "PATCH", headers: ADMIN, body: { price: 9000 } });
  assert.equal(edit.body.product.price, 9000);
  assert.equal((await call("/admin/products/mug-breathe", { method: "PATCH", headers: ADMIN, body: { price: -5 } })).status, 400);
});

test("mock controls: forced errors, delay, reset", async () => {
  const forced = await call("/products", { headers: { "X-Mock-Status": "503" } });
  assert.equal(forced.status, 503);
  assert.equal(forced.body.error.code, "mock_forced_error");

  const t = Date.now();
  await call("/health?_delay=300");
  assert.ok(Date.now() - t >= 290);

  await call("/orders", { method: "POST", body: order() });
  await call("/__mock/reset", { method: "POST" });
  assert.equal((await call("/products/journal-rooted")).body.product.stock, 24);
  assert.equal((await call("/admin/orders", { headers: ADMIN })).body.total, 10);
});
test("admin: a key set with ADMIN_API_KEY is required and never echoed back", async () => {
  const secret = "s3cret-admin-key-from-key-vault";
  const made = createApp({ log: false, adminApiKey: secret });
  const srv = made.app.listen(0);
  await new Promise((r) => srv.once("listening", r));
  const url = `http://localhost:${srv.address().port}/api/admin/orders`;
  try {
    const denied = await fetch(url, { headers: { Authorization: "Bearer mock-admin-key" } });
    assert.equal(denied.status, 401);
    assert.ok(!(await denied.text()).includes(secret));
    assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${secret}` } })).status, 200);
  } finally {
    srv.close();
  }
});
test("CORS allows any storefront origin", async () => {
  const res = await fetch(base + "/products", { headers: { Origin: "http://localhost:3000" } });
  assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:3000");
});
