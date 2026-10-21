// Dummy orders so the admin endpoints have something to show from the start.
// Built from a fixed recipe, so every restart produces the same orders.

const CUSTOMERS = [
  ["Adaeze Okafor", "adaeze.okafor@example.com", "+2348031234501", "lagos", "14 Admiralty Way", "Lekki"],
  ["Tunde Bakare", "tunde.bakare@example.com", "+2348051234502", "lagos", "3 Allen Avenue", "Ikeja"],
  ["Chiamaka Eze", "chiamaka.eze@example.com", "+2347061234503", "rivers", "22 Aba Road", "Port Harcourt"],
  ["Ibrahim Musa", "ibrahim.musa@example.com", "+2348091234504", "fct", "7 Aminu Kano Crescent", "Wuse II"],
  ["Funke Adeyemi", "funke.adeyemi@example.com", "+2348101234505", "other", "18 Ring Road", "Ibadan"],
  ["Emeka Nwosu", "emeka.nwosu@example.com", "+2349031234506", "other", "5 Ogui Road", "Enugu"],
  ["Zainab Bello", "zainab.bello@example.com", "+2348021234507", "fct", "40 Gana Street", "Maitama"],
  ["Segun Afolabi", "segun.afolabi@example.com", "+2347031234508", "lagos", "9 Adeola Odeku Street", "Victoria Island"],
];

// [customerIndex, status, ship, pay, daysAgo, [[productId, qty, size?]], promo?]
const RECIPES = [
  [0, "delivered", "std", "card", 21, [["journal-rooted", 1], ["candle-still", 1]]],
  [1, "delivered", "exp", "pod", 18, [["tee-soulwork", 2, "L"]]],
  [2, "shipped", "std", "transfer", 6, [["box-selfcare", 1]], "SOUL10"],
  [3, "paid", "std", "card", 3, [["hoodie-grace", 1, "M"], ["tote-carry", 1]]],
  [4, "awaiting_transfer", "std", "transfer", 1, [["planner-2027", 2], ["cards-intent", 1]]],
  [5, "cancelled", "std", "card", 9, [["cushion-adire", 1]]],
  [6, "confirmed", "exp", "pod", 0, [["oil-shea", 1], ["tea-calm", 2]]],
  [7, "pending_payment", "pickup", "card", 0, [["mug-breathe", 4]]],
  [0, "paid", "pickup", "card", 2, [["planner-2027", 1]], "SOUL10"],
  [2, "delivered", "std", "pod", 30, [["candle-still", 2], ["mug-breathe", 2]]],
];

export function buildSampleOrders({ byId, computeTotals, findPromo, estimateDelivery, now = new Date() }) {
  return RECIPES.map(([ci, status, ship, pay, daysAgo, items, promoCode], i) => {
    const [name, email, phone, zone, address, city] = CUSTOMERS[ci];
    const created = new Date(now);
    created.setDate(created.getDate() - daysAgo);
    created.setHours(9 + ((i * 3) % 9), (i * 17) % 60, 0, 0);

    const lines = items.map(([productId, qty, size = null]) => {
      const p = byId[productId];
      return { productId, name: p.name, size, unitPrice: p.price, qty, lineTotal: p.price * qty };
    });
    const promo = findPromo(promoCode);
    const iso = created.toISOString().replace("T", " ").slice(0, 19);
    const orderNo = "SI-MOCK" + String(i + 1).padStart(4, "0");

    return {
      orderNo,
      status,
      customer: { name, email, phone },
      delivery: {
        method: ship,
        zone,
        address: ship === "pickup" ? null : address,
        city: ship === "pickup" ? null : city,
        eta: estimateDelivery({ zone, ship }, created),
      },
      payment: {
        method: pay,
        reference: pay === "card" ? `${orderNo}-mock` : null,
        paidAt: ["paid", "shipped", "delivered"].includes(status) ? iso : null,
      },
      promoCode: promo?.code ?? null,
      notes: i === 2 ? "Please call on arrival." : null,
      items: lines,
      totals: computeTotals(lines, { promo, zone, ship }),
      createdAt: iso,
      updatedAt: iso,
    };
  });
}
