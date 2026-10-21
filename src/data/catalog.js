// Dummy catalogue served by the mock API. Edit freely; restart (or POST /api/__mock/reset) to apply.
// `image` can be any full URL. Without one, the storefront draws a placeholder from `glyph` and the colours.

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "journals", label: "Journals" },
  { id: "home", label: "Home & ritual" },
  { id: "apparel", label: "Apparel" },
  { id: "wellness", label: "Wellness" },
  { id: "gifts", label: "Gifts" },
];

export const PRODUCTS = [
  { id: "journal-rooted", name: "Rooted Affirmation Journal", cat: "journals", price: 12500, line: "I am grounded in what I choose.", glyph: "journal", c1: "#21463a", c2: "#e8a845", bg: "#cfe0d3", badge: "Bestseller", stock: 24, rank: 1,
    desc: "A5 linen-bound journal with 90 days of guided morning prompts and blank pages for evening reflection.",
    facts: [["Pages", "192, 100gsm"], ["Size", "A5, lay-flat binding"], ["Made in", "Lagos"]] },
  { id: "planner-2027", name: "Morning Pages Planner 2027", cat: "journals", price: 18000, line: "One page, one intention, every day.", glyph: "journal", c1: "#3b3a7a", c2: "#f2c5b8", bg: "#dcdcef", badge: "New", stock: 40, rank: 3,
    desc: "Dated January–December 2027 with weekly check-ins, a habit tracker and monthly gratitude spreads.",
    facts: [["Pages", "384"], ["Size", "B5, softcover"], ["Starts", "4 Jan 2027"]] },
  { id: "candle-still", name: "Still Waters Soy Candle", cat: "home", price: 15500, line: "Slow down. Breathe in.", glyph: "candle", c1: "#f4ece0", c2: "#e8a845", bg: "#e9dcc6", badge: "", stock: 4, rank: 2,
    desc: "Hand-poured soy wax scented with lemongrass and vetiver, in a reusable amber jar.",
    facts: [["Burn time", "45 hours"], ["Weight", "280 g"], ["Wick", "Cotton, lead-free"]] },
  { id: "mug-breathe", name: "Breathe Ceramic Mug", cat: "home", price: 8500, line: "Inhale calm, exhale hurry.", glyph: "mug", c1: "#d97a5b", c2: "#fff6ec", bg: "#f2d6c9", badge: "", stock: 30, rank: 6,
    desc: "Stoneware mug with a matte glaze and a hand-lettered reminder inside the rim.",
    facts: [["Holds", "350 ml"], ["Care", "Dishwasher safe"]] },
  { id: "tee-soulwork", name: "Soul Work Heavyweight Tee", cat: "apparel", price: 22000, line: "Doing the inner work, out loud.", glyph: "tee", c1: "#1f2a26", c2: "#e8a845", bg: "#d5d9d4", badge: "Bestseller", stock: 18, rank: 4, sizes: ["S", "M", "L", "XL", "XXL"],
    desc: "Boxy-fit 240gsm cotton tee with a screen-printed chest mark. Pre-shrunk.",
    facts: [["Fabric", "100% cotton, 240gsm"], ["Fit", "Relaxed, true to size"]] },
  { id: "hoodie-grace", name: "Grace in Motion Hoodie", cat: "apparel", price: 38000, line: "Move gently. Arrive anyway.", glyph: "hoodie", c1: "#5c6b4a", c2: "#f2f4f0", bg: "#d9dfcd", badge: "New", stock: 9, rank: 5, sizes: ["S", "M", "L", "XL"],
    desc: "Brushed fleece hoodie with embroidered back script and a deep kangaroo pocket.",
    facts: [["Fabric", "80% cotton, 20% poly"], ["Fit", "Oversized"]] },
  { id: "oil-shea", name: "Shea & Frankincense Body Oil", cat: "wellness", price: 14000, line: "Care for the body that carries you.", glyph: "bottle", c1: "#b8742f", c2: "#fdf3e2", bg: "#ecd9bd", badge: "", stock: 22, rank: 7,
    desc: "Light body oil with Nigerian shea, frankincense and vitamin E. Absorbs in under a minute.",
    facts: [["Volume", "100 ml"], ["Skin", "All types"]] },
  { id: "tea-calm", name: "Calm Blend Herbal Tea", cat: "wellness", price: 6500, line: "A pause in a cup.", glyph: "tea", c1: "#a8323b", c2: "#f6d38b", bg: "#efd0cf", badge: "", stock: 3, rank: 9,
    desc: "Loose-leaf hibiscus (zobo), ginger and lemongrass. Caffeine-free.",
    facts: [["Weight", "100 g, ~40 cups"], ["Steep", "5 min, 95°C"]] },
  { id: "cards-intent", name: "Daily Intention Card Deck", cat: "gifts", price: 9500, line: "Draw one. Live it today.", glyph: "cards", c1: "#21463a", c2: "#e8a845", bg: "#d6e3e0", badge: "", stock: 35, rank: 8,
    desc: "52 illustrated cards, one intention for each week of the year, in a keepsake box.",
    facts: [["Cards", "52 + guide"], ["Finish", "Matte, 350gsm"]] },
  { id: "tote-carry", name: "Carry Light Canvas Tote", cat: "apparel", price: 11000, line: "Only carry what serves you.", glyph: "tote", c1: "#efe4cf", c2: "#21463a", bg: "#cfd8cf", badge: "", stock: 27, rank: 10,
    desc: "Heavy canvas tote with an inner zip pocket and long shoulder straps.",
    facts: [["Size", "40 × 38 × 10 cm"], ["Fabric", "12oz cotton canvas"]] },
  { id: "box-selfcare", name: "Self-Care Gift Box", cat: "gifts", price: 45000, line: "A whole evening, wrapped.", glyph: "box", c1: "#21463a", c2: "#e8a845", bg: "#cbd9cf", badge: "Bestseller", stock: 7, rank: 2.5,
    desc: "Rooted Journal, Still Waters candle, Calm Blend tea and a Breathe mug, boxed with a handwritten note.",
    facts: [["Includes", "4 items"], ["Saves", "₦7,500 vs. separately"]] },
  { id: "cushion-adire", name: "Adire Meditation Cushion", cat: "home", price: 27500, line: "Sit. Stay a while.", glyph: "cushion", c1: "#2b3f7a", c2: "#d7e0f5", bg: "#d5dbec", badge: "New", stock: 11, rank: 11,
    desc: "Buckwheat-filled zafu with a removable hand-dyed adire indigo cover from Abeokuta.",
    facts: [["Diameter", "38 cm"], ["Fill", "Buckwheat hulls"]] },
];

export const BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

export const INTENTIONS = [
  "I give myself permission to rest.",
  "Small steps are still steps.",
  "What I seek is seeking me.",
  "I am allowed to begin again.",
  "Peace is my priority today.",
];
