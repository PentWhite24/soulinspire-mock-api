// All mock data lives in memory. Nothing is written to disk; restart or reset to start over.
import { PRODUCTS } from "./data/catalog.js";
import { buildSampleOrders } from "./data/sample-orders.js";
import { computeTotals, estimateDelivery, findPromo, ZONES } from "./pricing.js";

const clone = (v) => structuredClone(v);

export function createStore() {
  const state = { products: [], orders: [], seq: 0 };

  function reset() {
    state.products = clone(PRODUCTS).map((p) => ({ ...p, active: true }));
    const byId = Object.fromEntries(state.products.map((p) => [p.id, p]));
    state.orders = buildSampleOrders({ byId, computeTotals, findPromo, estimateDelivery });
    state.seq = 0;
  }
  reset();

  const byId = (id) => state.products.find((p) => p.id === id);
  const withZoneLabel = (o) => ({ ...o, delivery: { ...o.delivery, zoneLabel: ZONES[o.delivery.zone].label } });
  const publicProduct = ({ active, ...p }) => (active ? p : { ...p, active: false });

  return {
    reset,

    products: {
      list: ({ includeInactive = false } = {}) => state.products.filter((p) => includeInactive || p.active).map(publicProduct),
      get: (id) => {
        const p = byId(id);
        return p ? publicProduct(p) : null;
      },
      raw: byId,
      update(id, patch) {
        const p = byId(id);
        if (!p) return null;
        Object.assign(p, patch);
        return publicProduct(p);
      },
      takeStock(id, qty) {
        byId(id).stock -= qty;
      },
      returnStock(id, qty) {
        const p = byId(id);
        if (p) p.stock += qty;
      },
    },

    orders: {
      nextOrderNo: () => "SI-" + Date.now().toString(36).toUpperCase().slice(-5) + String(++state.seq).padStart(3, "0"),
      add(order) {
        state.orders.unshift(order);
        return withZoneLabel(order);
      },
      get(orderNo) {
        const o = state.orders.find((x) => x.orderNo === orderNo);
        return o ? withZoneLabel(o) : null;
      },
      raw: (orderNo) => state.orders.find((x) => x.orderNo === orderNo),
      byRef: (ref) => state.orders.find((x) => x.payment.reference === ref),
      byKey: (key) => state.orders.find((x) => x.idempotencyKey === key),
      list: ({ status, limit = 50, offset = 0 } = {}) => {
        const all = state.orders.filter((o) => !status || o.status === status);
        return { orders: all.slice(offset, offset + limit).map(withZoneLabel), total: all.length };
      },
    },
  };
}
