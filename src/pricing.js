// Server-side pricing. The client shows the same numbers, but these are the ones that count.

export const FREE_DELIVERY_OVER = 50000;
export const VAT_RATE = 0.075;

export const ZONES = {
  lagos: { label: "Lagos", std: 2500, exp: 4500, days: "1–2 days", etaDays: 2 },
  rivers: { label: "Rivers (Port Harcourt)", std: 3000, exp: 5500, days: "2–3 days", etaDays: 3 },
  fct: { label: "FCT (Abuja)", std: 3000, exp: 5500, days: "2–3 days", etaDays: 3 },
  other: { label: "Other states", std: 4500, exp: 8000, days: "3–6 days", etaDays: 6 },
};

export const PROMO_CODES = {
  SOUL10: { pct: 0.1, description: "10% off your order" },
};

export const SHIP_METHODS = ["std", "exp", "pickup"];
export const PAY_METHODS = ["card", "transfer", "pod"];
// Pay on delivery is only offered where Soulinspire runs its own riders.
export const POD_ZONES = ["lagos", "rivers", "fct"];

export function findPromo(code) {
  if (!code) return null;
  const key = String(code).trim().toUpperCase();
  return PROMO_CODES[key] ? { code: key, ...PROMO_CODES[key] } : null;
}

/** lines: [{ unitPrice, qty }] */
export function computeTotals(lines, { promo = null, zone = "lagos", ship = "std" } = {}) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const discount = promo ? Math.round(subtotal * promo.pct) : 0;
  const afterDiscount = subtotal - discount;
  const z = ZONES[zone];

  let delivery = 0;
  if (subtotal > 0 && ship === "exp") delivery = z.exp;
  if (subtotal > 0 && ship === "std") delivery = afterDiscount >= FREE_DELIVERY_OVER ? 0 : z.std;

  const vat = Math.round(afterDiscount * VAT_RATE);
  return { subtotal, discount, delivery, vat, total: afterDiscount + delivery + vat };
}

export function estimateDelivery({ zone, ship }, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + (ship === "exp" ? 1 : ship === "pickup" ? 1 : ZONES[zone].etaDays));
  return d.toISOString().slice(0, 10);
}
