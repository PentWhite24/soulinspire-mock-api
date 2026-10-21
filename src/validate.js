// Small hand-written checks that return the same error shape as the real API:
// { fields: { "customer.email": "message", ... } }
import { PAY_METHODS, POD_ZONES, SHIP_METHODS, ZONES } from "./pricing.js";

const NIGERIAN_MOBILE = /^(\+?234|0)[789][01]\d{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v) => (typeof v === "string" ? v.trim() : "");

export function normalisePhone(raw) {
  const d = raw.replace(/[\s-]/g, "");
  if (d.startsWith("+234")) return d;
  if (d.startsWith("234")) return "+" + d;
  return "+234" + d.slice(1);
}

export function validateItems(items, fields) {
  if (!Array.isArray(items) || items.length === 0) {
    fields.items = "Your bag is empty.";
    return;
  }
  items.forEach((it, i) => {
    if (!it || typeof it.productId !== "string") fields[`items.${i}.productId`] = "Missing product.";
    if (!Number.isInteger(it?.qty) || it.qty < 1 || it.qty > 50) fields[`items.${i}.qty`] = "Quantity must be a whole number from 1 to 50.";
  });
}

export function validateOrder(body) {
  const fields = {};
  const c = body?.customer || {};
  const d = body?.delivery || {};
  const p = body?.payment || {};

  if (str(c.name).length < 2) fields["customer.name"] = "Enter your full name.";
  if (!NIGERIAN_MOBILE.test(str(c.phone).replace(/[\s-]/g, ""))) fields["customer.phone"] = "Enter a Nigerian mobile number, e.g. 0803 123 4567.";
  if (!EMAIL.test(str(c.email))) fields["customer.email"] = "Enter an email address like name@example.com.";

  if (!SHIP_METHODS.includes(d.method)) fields["delivery.method"] = `Choose one of: ${SHIP_METHODS.join(", ")}.`;
  if (!ZONES[d.zone]) fields["delivery.zone"] = `Choose one of: ${Object.keys(ZONES).join(", ")}.`;
  if (d.method !== "pickup") {
    if (str(d.address).length < 5) fields["delivery.address"] = "Enter a street address for delivery.";
    if (str(d.city).length < 2) fields["delivery.city"] = "Enter your city or town.";
  }

  if (!PAY_METHODS.includes(p.method)) fields["payment.method"] = `Choose one of: ${PAY_METHODS.join(", ")}.`;
  else if (p.method === "pod" && !POD_ZONES.includes(d.zone)) fields["payment.method"] = "Pay on delivery isn't available in this state. Choose card or bank transfer.";

  validateItems(body?.items, fields);
  return fields;
}
