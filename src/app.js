import express from "express";
import cors from "cors";
import { timingSafeEqual } from "node:crypto";
import { CATEGORIES, INTENTIONS } from "./data/catalog.js";
import { computeTotals, estimateDelivery, findPromo, FREE_DELIVERY_OVER, POD_ZONES, VAT_RATE, ZONES } from "./pricing.js";
import { createStore } from "./store.js";
import { normalisePhone, validateItems, validateOrder } from "./validate.js";

const ORDER_STATUSES = ["pending_payment", "awaiting_transfer", "confirmed", "paid", "shipped", "delivered", "cancelled"];
const TRANSITIONS = {
  pending_payment: ["paid", "cancelled"],
  awaiting_transfer: ["paid", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  paid: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};
const SORTS = {
  featured: (a, b) => a.rank - b.rank,
  new: (a, b) => (b.badge === "New") - (a.badge === "New") || a.rank - b.rank,
  low: (a, b) => a.price - b.price || a.rank - b.rank,
  high: (a, b) => b.price - a.price || a.rank - b.rank,
};

class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    Object.assign(this, { status, code, extra });
  }
}
const fail = (status, code, message, extra) => { throw new ApiError(status, code, message, extra); };
const DEFAULT_ADMIN_KEY = "mock-admin-key";

// Compares in constant time, so response timing doesn't reveal how much of a guess was right.
function sameKey(given, expected) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApp(config = {}) {
  const {
    delayMs = 0,
    frontendUrl = "http://localhost:5173",
    adminApiKey = "mock-admin-key",
    bank = { bankName: "Mock Bank", accountName: "Soulinspire Ltd", accountNumber: "0123456789" },
    pickup = { address: "Lekki Phase 1, Lagos", hours: "Mon–Sat, 10am–6pm" },
    log = true,
  } = config;

  const store = createStore();
  const app = express();
  app.disable("x-powered-by");

  // Any origin may call the mock, so it works from whatever port or preview host you use.
  app.use(cors({ origin: true, allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Mock-Status"] }));
  app.use(express.json({ limit: "100kb" }));

  if (log) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on("finish", () => console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - start}ms)`));
      next();
    });
  }

  // Mock controls: slow responses down, or force an error, to test loading and error states.
  //   ?_delay=1500            wait 1.5 s before answering (MOCK_DELAY_MS sets a default for every request)
  //   X-Mock-Status: 500      answer with that error status instead of real data
  app.use("/api", (req, _res, next) => {
    const forced = Number(req.get("X-Mock-Status"));
    const wait = Number(req.query._delay ?? delayMs) || 0;
    const go = () => {
      if (forced >= 400 && forced < 600) return next(new ApiError(forced, "mock_forced_error", `Forced ${forced} response (X-Mock-Status header).`));
      next();
    };
    wait > 0 ? setTimeout(go, Math.min(wait, 30_000)) : go();
  });

  /* ---------------- helpers ---------------- */

  function priceLines(items) {
    const merged = new Map();
    for (const it of items) {
      const key = `${it.productId}|${it.size ?? ""}`;
      merged.set(key, { productId: it.productId, size: it.size ?? null, qty: (merged.get(key)?.qty || 0) + it.qty });
    }
    const problems = [];
    const lines = [];
    const perProduct = new Map();
    for (const it of merged.values()) {
      const p = store.products.raw(it.productId);
      if (!p || !p.active) { problems.push({ productId: it.productId, reason: "unavailable" }); continue; }
      if (p.sizes && !p.sizes.includes(it.size)) { problems.push({ productId: p.id, reason: "size_required", sizes: p.sizes }); continue; }
      if (!p.sizes && it.size) { problems.push({ productId: p.id, reason: "no_sizes" }); continue; }
      perProduct.set(p.id, (perProduct.get(p.id) || 0) + it.qty);
      lines.push({ productId: p.id, name: p.name, size: it.size, unitPrice: p.price, qty: it.qty, lineTotal: p.price * it.qty });
    }
    for (const [id, qty] of perProduct) {
      const stock = store.products.raw(id).stock;
      if (qty > stock) problems.push({ productId: id, reason: "insufficient_stock", available: stock });
    }
    if (problems.length) fail(409, "cart_unavailable", "Some items in your bag are no longer available as chosen.", { details: problems });
    return lines;
  }

  function promoFrom(code) {
    if (!code) return null;
    return findPromo(code) || fail(400, "invalid_promo", "That promo code isn't valid.");
  }

  function setStatus(order, status) {
    if (order.status === status) return;
    if (!TRANSITIONS[order.status].includes(status)) {
      fail(409, "invalid_transition", `An order that is ${order.status.replace("_", " ")} can't be marked ${status.replace("_", " ")}.`);
    }
    if (status === "cancelled") order.items.forEach((i) => store.products.returnStock(i.productId, i.qty));
    order.status = status;
    order.updatedAt = new Date().toISOString().replace("T", " ").slice(0, 19);
    if (status === "paid") order.payment.paidAt = order.updatedAt;
  }

  const requireAdmin = (req, _res, next) => {
    const token = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
    
    if (!sameKey(token, adminApiKey)) {
     // Only the public default key is ever shown. A key set with ADMIN_API_KEY is never echoed back.
     const hint = adminApiKey === DEFAULT_ADMIN_KEY
     ? `Send "Authorization: Bearer ${DEFAULT_ADMIN_KEY}" to use the admin endpoints.`
     : "Send a valid admin key in the Authorization header.";
     return next(new ApiError(401, "unauthorised", hint));
   }
    next();
  };

  /* ---------------- shop ---------------- */

  const api = express.Router();

  api.get("/health", (_req, res) => res.json({ ok: true, payments: "mock", mock: true, time: new Date().toISOString() }));

  api.get("/products", (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const category = String(req.query.category || "all");
    const sort = SORTS[req.query.sort] ? req.query.sort : "featured";
    const products = store.products
      .list()
      .filter((p) => category === "all" || p.cat === category)
      .filter((p) => !q || `${p.name} ${p.line} ${p.desc} ${p.cat}`.toLowerCase().includes(q))
      .sort(SORTS[sort]);
    res.json({ products });
  });

  api.get("/products/:id", (req, res) => {
    const p = store.products.get(req.params.id);
    if (!p || p.active === false) fail(404, "not_found", "Product not found.");
    res.json({ product: p });
  });

  api.get("/categories", (_req, res) => res.json({ categories: CATEGORIES }));

  api.get("/config", (_req, res) =>
    res.json({ currency: "NGN", vatRate: VAT_RATE, freeDeliveryOver: FREE_DELIVERY_OVER, zones: ZONES, payOnDeliveryZones: POD_ZONES, pickup, intentions: INTENTIONS })
  );

  api.post("/promo/validate", (req, res) => {
    const code = String(req.body?.code || "").trim();
    if (!code) fail(400, "validation_failed", "Some details need fixing.", { fields: { code: "Enter a promo code." } });
    const promo = findPromo(code) || fail(404, "invalid_promo", "That promo code isn't valid.");
    res.json({ promo: { code: promo.code, pct: promo.pct, description: promo.description } });
  });

  api.post("/orders/quote", (req, res) => {
    const fields = {};
    validateItems(req.body?.items, fields);
    if (Object.keys(fields).length) fail(400, "validation_failed", "Some details need fixing.", { fields });
    const { zone = "lagos", method = "std" } = req.body.delivery || {};
    const promo = promoFrom(req.body.promoCode);
    const lines = priceLines(req.body.items);
    res.json({ items: lines, promo: promo && { code: promo.code, pct: promo.pct }, totals: computeTotals(lines, { promo, zone, ship: method }) });
  });

  api.post("/orders", (req, res) => {
    const key = req.get("Idempotency-Key");
    const existing = key && store.orders.byKey(key);
    if (existing) return res.json({ order: store.orders.get(existing.orderNo), payment: paymentInfo(existing) });

    const fields = validateOrder(req.body);
    if (Object.keys(fields).length) fail(400, "validation_failed", "Some details need fixing.", { fields });

    const { customer, delivery, payment, items, promoCode, notes } = req.body;
    const promo = promoFrom(promoCode);
    const lines = priceLines(items);
    lines.forEach((l) => store.products.takeStock(l.productId, l.qty));

    const orderNo = store.orders.nextOrderNo();
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const pickupOnly = delivery.method === "pickup";
    const order = {
      orderNo,
      idempotencyKey: key || null,
      status: { card: "pending_payment", transfer: "awaiting_transfer", pod: "confirmed" }[payment.method],
      customer: { name: customer.name.trim(), email: customer.email.trim().toLowerCase(), phone: normalisePhone(customer.phone) },
      delivery: {
        method: delivery.method,
        zone: delivery.zone,
        address: pickupOnly ? null : delivery.address.trim(),
        city: pickupOnly ? null : delivery.city.trim(),
        eta: estimateDelivery({ zone: delivery.zone, ship: delivery.method }),
      },
      payment: { method: payment.method, reference: payment.method === "card" ? `${orderNo}-mock` : null, paidAt: null },
      promoCode: promo?.code ?? null,
      notes: notes?.trim() || null,
      items: lines,
      totals: computeTotals(lines, { promo, zone: delivery.zone, ship: delivery.method }),
      createdAt: now,
      updatedAt: now,
    };
    store.orders.add(order);
    res.status(201).json({ order: store.orders.get(orderNo), payment: paymentInfo(order) });
  });

  function paymentInfo(order) {
    const info = { method: order.payment.method };
    if (order.payment.method === "card" && order.status === "pending_payment") {
      info.reference = order.payment.reference;
      // No real payment page: send the customer straight back, as Paystack would after paying.
      info.authorizationUrl = `${frontendUrl.replace(/\/$/, "")}/?order=${order.orderNo}&reference=${order.payment.reference}`;
    }
    if (order.payment.method === "transfer") info.bankDetails = { ...bank, amount: order.totals.total, reference: order.orderNo };
    if (order.delivery.method === "pickup") info.pickup = pickup;
    return info;
  }

  api.get("/orders/:orderNo", (req, res) => {
    const order = store.orders.get(req.params.orderNo);
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!order || !email || order.customer.email !== email) fail(404, "not_found", "Order not found.");
    res.json({ order: strip(order) });
  });

  // Every card payment "succeeds". End a reference with "-decline" to test the unpaid path.
  api.get("/payments/verify/:reference", (req, res) => {
    const ref = req.params.reference;
    const order = store.orders.byRef(ref.replace(/-decline$/, ""));
    if (!order) fail(404, "not_found", "Payment not found.");
    if (order.status === "cancelled") fail(410, "order_cancelled", "This order was cancelled before payment arrived. Contact us and we'll sort it out.");
    if (order.status === "pending_payment" && !ref.endsWith("-decline")) setStatus(order, "paid");
    res.json({ paid: order.status !== "pending_payment", order: strip(store.orders.get(order.orderNo)) });
  });

  // Accepts any body; marks the order paid if it names a known reference. No signature check.
  api.post("/payments/webhook", (req, res) => {
    const order = store.orders.byRef(req.body?.data?.reference);
    if (order?.status === "pending_payment" && req.body?.event === "charge.success") setStatus(order, "paid");
    res.sendStatus(200);
  });

  /* ---------------- admin ---------------- */

  const admin = express.Router();
  admin.use(requireAdmin);

  admin.get("/orders", (req, res) => {
    const status = req.query.status;
    if (status && !ORDER_STATUSES.includes(status)) fail(400, "validation_failed", "Some details need fixing.", { fields: { status: `Use one of: ${ORDER_STATUSES.join(", ")}.` } });
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const { orders, total } = store.orders.list({ status, limit, offset });
    res.json({ orders: orders.map(strip), total });
  });

  admin.get("/orders/:orderNo", (req, res) => {
    const order = store.orders.get(req.params.orderNo) || fail(404, "not_found", "Order not found.");
    res.json({ order: strip(order) });
  });

  admin.patch("/orders/:orderNo", (req, res) => {
    const order = store.orders.raw(req.params.orderNo) || fail(404, "not_found", "Order not found.");
    const status = req.body?.status;
    if (!ORDER_STATUSES.includes(status)) fail(400, "validation_failed", "Some details need fixing.", { fields: { status: `Use one of: ${ORDER_STATUSES.join(", ")}.` } });
    setStatus(order, status);
    res.json({ order: strip(store.orders.get(order.orderNo)) });
  });

  admin.get("/products", (_req, res) => res.json({ products: store.products.list({ includeInactive: true }) }));

  admin.patch("/products/:id", (req, res) => {
    const allowed = ["name", "price", "stock", "badge", "image", "description", "line", "active"];
    const patch = {};
    const fields = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (!allowed.includes(k)) { fields[k] = "This field can't be changed."; continue; }
      if ((k === "price" || k === "stock") && !(Number.isInteger(v) && v >= 0)) { fields[k] = "Use a whole number, 0 or more."; continue; }
      if (k === "active" && typeof v !== "boolean") { fields[k] = "Use true or false."; continue; }
      patch[k === "description" ? "desc" : k] = v;
    }
    if (!Object.keys(patch).length && !Object.keys(fields).length) fields._ = "Send at least one field to change.";
    if (Object.keys(fields).length) fail(400, "validation_failed", "Some details need fixing.", { fields });
    const product = store.products.update(req.params.id, patch) || fail(404, "not_found", "Product not found.");
    res.json({ product });
  });

  /* ---------------- mock controls ---------------- */

  api.post("/__mock/reset", (_req, res) => {
    store.reset();
    res.json({ ok: true, message: "Products, stock and orders are back to the starting dummy data." });
  });

  api.use("/admin", admin);
  app.use("/api", api);

  app.get("/", (_req, res) => res.json({ name: "Soulinspire Mock API", mock: true, health: "/api/health", docs: "See README.md" }));
  app.use((_req, _res, next) => next(new ApiError(404, "not_found", "No such endpoint.")));

  // Same error shape as the real API.
  app.use((err, _req, res, _next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: { code: "bad_json", message: "The request body is not valid JSON." } });
    if (!(err instanceof ApiError)) {
      console.error(err);
      return res.status(500).json({ error: { code: "server_error", message: "Something went wrong on our side. Please try again." } });
    }
    res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } });
  });

  return { app, store };
}

const strip = ({ idempotencyKey, ...o }) => o;
