/* ------------------------------------------------------------------
   data.js — one fictional customer, deterministic mock transactions.
   Nothing here is real account data.
   ------------------------------------------------------------------ */

const APP = {
  name: "Future Me",
  tagline: "Your money, a few steps ahead",
  bank: "Westpac",
  today: new Date(2026, 10, 16), // Mon 16 Nov 2026 (hackathon day 1)
};

const CUSTOMER = {
  first: "Abhi",
  name: "Abhi S",
  age: 27,
  suburb: "Surfers Paradise",
  payNet: 2120,            // net pay, fortnightly
  firstPayday: new Date(2026, 4, 21), // Thu 21 May 2026; every 14 days after
  balances: { everyday: 2184.6 },     // savings now live on each goal and the emergency fund below
  savingsRate: 0.045,      // p.a. on every savings pot
  card: { limit: 3000, owing: 640, due: new Date(2026, 10, 24), minimum: 25 },
};

/* ---------- goals ----------
   type:     "car" | "vacation" | "other" (picks the artwork in the window panel)
   saved:    balance of that goal's savings pot today
   due:      the date the customer wants it by (the schedule the mood is measured against)
   auto:     optional auto transfer, e.g. { amount: 50, every: "payday" } or { amount: 100, every: "second" }
   priority: 1 is the "hero" goal shown as the window background and on the Goal tab            */
const GOALS = [
  {
    id: "car", name: "Ford GT 40", fund: "Car Fund", type: "car", emoji: "🚗",
    target: 14000, saved: 3420, due: new Date(2028, 3, 30), auto: null, priority: 1,
    desc: "2005 Ford GT 40 after trading in the old Corolla",
  },
  {
    id: "trip", name: "Japan trip", fund: "Trip Fund", type: "vacation", emoji: "🗾",
    target: 6000, saved: 2100, due: new Date(2028, 10, 30), auto: null, priority: 2,
    desc: "Two weeks in Tokyo and Kyoto",
  },
];

/* ---------- emergency fund ----------
   Target is not stored: the engine calculates it as `months` × essential monthly costs. */
const EMERGENCY_FUND = { name: "Emergency fund", months: 3, saved: 3450 };

/* ---------- loans ---------- */
const LOANS = [
  { id: "pl", name: "Personal loan", lender: "Westpac", original: 10000, balance: 8500, rate: 0.099, repayment: 166, day: 15 },
];

/* ---------- insurances ----------
   source: "Westpac" (held with the bank) or "added manually" (held elsewhere, typed in by the customer).
   `recurring` links the policy to its direct debit in RECURRING below.                                   */
const INSURANCES = [
  { id: "car",    type: "car",    icon: "🚘", name: "Car insurance",    provider: "Westpac",  premium: 89,  per: "month", renewal: new Date(2027, 1, 27), source: "Westpac",        recurring: "Westpac Car Insurance" },
  { id: "health", type: "health", icon: "🩺", name: "Health insurance", provider: "Medibank", premium: 148, per: "month", renewal: new Date(2027, 3, 1),  source: "added manually", recurring: "Medibank Health Cover" },
];

/* ---------- projection assumptions (editable in "Show calculation") ---------- */
const ASSUMPTIONS = {
  inflation: 0.03,     // spending and essential costs rise this much a year
  salaryGrowth: 0.03,  // pay rises once a year by this much
  buffer: 0.05,        // share of monthly spending set aside for random expenses
};

// Spending categories in fixed display order. Colours come from a validated
// categorical palette (dataviz skill reference palette) and never change order.
const CATEGORIES = [
  { id: "Rent",          label: "Rent",          color: "#2a78d6", essential: true },
  { id: "Groceries",     label: "Groceries",     color: "#eb6834", essential: true },
  { id: "EatingOut",     label: "Eating out",    color: "#1baf7a", essential: false },
  { id: "Transport",     label: "Transport",     color: "#eda100", essential: true },
  { id: "Subscriptions", label: "Subscriptions", color: "#e87ba4", essential: false },
  { id: "Shopping",      label: "Shopping",      color: "#008300", essential: false },
  { id: "Bills",         label: "Bills",         color: "#6250d6", essential: true },
  { id: "Fun",           label: "Fun & health",  color: "#e34948", essential: false },
];
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

// Recurring debits (day of month). `since` = first charge date.
const RECURRING = [
  { name: "Rent – Surfers Paradise",      cat: "Rent",          amount: 1560,  day: 1 },
  { name: "FitFlex Gym",                  cat: "Subscriptions", amount: 64.00, day: 2,  group: "fitness" },
  { name: "Netflix",                      cat: "Subscriptions", amount: 18.99, day: 4 },
  { name: "Medibank Health Cover",        cat: "Bills",         amount: 148,   day: 6 },
  { name: "Spotify Premium",              cat: "Subscriptions", amount: 13.99, day: 7,  group: "music" },
  { name: "Apple Music",                  cat: "Subscriptions", amount: 12.99, day: 9,  group: "music" },
  { name: "Disney+",                      cat: "Subscriptions", amount: 15.99, day: 12 },
  { name: "Peloton App",                  cat: "Subscriptions", amount: 19.99, day: 14, group: "fitness" },
  { name: "Zenlist Pro",                  cat: "Subscriptions", amount: 12.99, day: 20, since: new Date(2026, 7, 20), trial: true },
  { name: "iCloud+ 2TB",                  cat: "Subscriptions", amount: 14.99, day: 23, group: "storage" },
  { name: "Optus Mobile",                 cat: "Bills",         amount: 49,    day: 16 },
  { name: "Aussie Broadband",             cat: "Bills",         amount: 79,    day: 18 },
  { name: "Origin Energy",                cat: "Bills",         amount: 92,    day: 25 },
  { name: "Westpac Car Insurance",        cat: "Bills",         amount: 89,    day: 27 },
  { name: "Afterpay instalment",          cat: "Shopping",      amount: 45,    day: 10, until: new Date(2026, 11, 10), bnpl: true },
];

const MERCHANTS = {
  groceries: ["Woolworths Burleigh", "Coles West Burleigh", "ALDI Varsity Lakes"],
  coffee: "Elk Espresso",
  delivery: ["Uber Eats", "Uber Eats", "DoorDash"],
  lunch: ["Guzman y Gomez", "Zambrero", "Sushi Hub", "Boost Juice"],
  fuel: "Ampol Burleigh Heads",
  shopping: ["Kmart Robina", "Cotton On", "Amazon AU", "JB Hi-Fi", "The Iconic", "Bunnings"],
  fun: ["Event Cinemas Pacific Fair", "Burleigh Brewing Co", "Dan Murphy's", "Black Hops Taproom"],
  health: ["Chemist Warehouse", "Priceline Pharmacy"],
};

/* ---------- deterministic PRNG so every demo run is identical ---------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function paydayIndex(d) { return Math.round((d - CUSTOMER.firstPayday) / 86400000); }
function isPayday(d) {
  const diff = paydayIndex(d);
  return diff >= 0 && diff % 14 === 0;
}
function daysSincePayday(d) {
  const diff = paydayIndex(d);
  return diff < 0 ? 99 : diff % 14;
}

/* ---------- generate ~6 months of transactions ---------- */
function generateTransactions(scenario) {
  const rnd = mulberry32(20261116);
  const start = new Date(2026, 4, 18); // Mon 18 May 2026
  const end = APP.today;
  const tx = [];
  const push = (date, name, cat, amount, meta = {}) =>
    tx.push({ date: new Date(date), name, cat, amount: Math.round(amount * 100) / 100, ...meta });

  let lastFuel = addDays(start, -6);
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const dow = d.getDay(); // 0 Sun .. 6 Sat
    const dom = d.getDate();
    const afterPay = daysSincePayday(d) <= 2;

    // income
    if (isPayday(d)) {
      let pay = CUSTOMER.payNet;
      let note = "Salary – Studio Nine Design";
      if (scenario.reducedPay && sameDay(d, new Date(2026, 10, 5))) { pay = 1480; note += " (reduced hours)"; }
      push(d, note, "Income", pay, { income: true });
      if (rnd() < 0.75 && !(scenario.reducedPay && d >= new Date(2026, 10, 5))) {
        push(d, "Transfer to Car Fund", "Savings", -150, { transfer: true });
      }
    }

    // recurring debits
    for (const r of RECURRING) {
      if (r.day !== dom) continue;
      if (r.since && d < r.since) continue;
      if (r.until && d > r.until) continue;
      push(d, r.name, r.cat, -r.amount, { recurring: true });
    }

    // loan repayments (tracked separately from spending)
    for (const l of LOANS) {
      if (l.day === dom) push(d, `${l.name} repayment`, "Loan", -l.repayment, { loan: true, recurring: true });
    }

    // groceries: main shop Sat/Sun + a top-up midweek
    if (dow === 6) push(d, MERCHANTS.groceries[Math.floor(rnd() * 3)], "Groceries", -(68 + rnd() * 40));
    if (dow === 3 && rnd() < 0.6) push(d, MERCHANTS.groceries[Math.floor(rnd() * 3)], "Groceries", -(18 + rnd() * 22));

    // weekday coffee habit
    if (dow >= 1 && dow <= 5 && rnd() < 0.82) push(d, MERCHANTS.coffee, "EatingOut", -(rnd() < 0.25 ? 9.5 : 5.5), { coffee: true });

    // lunches
    if (dow >= 1 && dow <= 5 && rnd() < (afterPay ? 0.4 : 0.2)) push(d, MERCHANTS.lunch[Math.floor(rnd() * 4)], "EatingOut", -(13 + rnd() * 7));

    // Friday / Saturday night delivery habit
    if ((dow === 5 || dow === 6) && rnd() < 0.75) push(d, MERCHANTS.delivery[Math.floor(rnd() * 3)], "EatingOut", -(30 + rnd() * 16), { delivery: true });
    if (dow === 2 && rnd() < 0.15) push(d, "Uber Eats", "EatingOut", -(28 + rnd() * 12), { delivery: true });

    // fuel roughly every 10 days
    if ((d - lastFuel) / 86400000 >= 9 && rnd() < 0.5) { push(d, MERCHANTS.fuel, "Transport", -(62 + rnd() * 20)); lastFuel = d; }
    if (rnd() < 0.05) push(d, "Translink go card", "Transport", -20);

    // shopping, spikes after payday
    if (rnd() < (afterPay ? 0.25 : 0.06)) push(d, MERCHANTS.shopping[Math.floor(rnd() * 6)], "Shopping", -(22 + rnd() * 100));

    // fun & health
    if (dow === 6 && rnd() < 0.4) push(d, MERCHANTS.fun[Math.floor(rnd() * 4)], "Fun", -(25 + rnd() * 50));
    if (rnd() < 0.04) push(d, MERCHANTS.health[Math.floor(rnd() * 2)], "Fun", -(14 + rnd() * 45));
  }

  // scenario: a tough month
  if (scenario.carRepair) push(new Date(2026, 10, 12), "Burleigh Auto Repairs – clutch", "Transport", -1350, { shock: true });

  tx.sort((a, b) => a.date - b.date);
  return tx;
}

const SCENARIOS = {
  normal: { id: "normal", label: "Normal month", reducedPay: false, carRepair: false },
  tough:  { id: "tough",  label: "Tough month",  reducedPay: true,  carRepair: true },
};

/* ---------- CSV import (bonus): date,description,amount[,category] ---------- */
function parseCsvTransactions(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const header = lines[0].toLowerCase();
  const rows = header.includes("date") ? lines.slice(1) : lines;
  const out = [];
  for (const line of rows) {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(c => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim());
    if (cells.length < 3) continue;
    const date = new Date(cells[0]);
    const amount = parseFloat(cells[2].replace(/[^0-9.\-]/g, ""));
    if (isNaN(date) || isNaN(amount)) continue;
    const name = cells[1];
    const cat = cells[3] && CAT[cells[3]] ? cells[3] : autoCategorise(name, amount);
    const meta = {};
    if (amount > 0 && /salary|pay|wage/i.test(name)) meta.income = true;
    if (/uber eats|doordash|menulog/i.test(name)) meta.delivery = true;
    if (/espresso|coffee|cafe/i.test(name)) meta.coffee = true;
    if (/transfer.*(fund|saving)/i.test(name)) meta.transfer = true;
    if (amount < 0 && /loan repayment/i.test(name)) meta.loan = true;
    out.push({ date, name, cat: meta.income ? "Income" : meta.transfer ? "Savings" : meta.loan ? "Loan" : cat, amount, ...meta });
  }
  out.sort((a, b) => a.date - b.date);
  return out;
}

function autoCategorise(name, amount) {
  const n = name.toLowerCase();
  if (amount > 0) return "Income";
  if (/rent|real estate|property/.test(n)) return "Rent";
  if (/woolworths|coles|aldi|iga|grocer/.test(n)) return "Groceries";
  if (/uber eats|doordash|menulog|espresso|cafe|coffee|guzman|zambrero|sushi|mcdonald|kfc|hungry|boost/.test(n)) return "EatingOut";
  if (/ampol|bp |shell|caltex|translink|uber(?! eats)|fuel|auto|mechanic|parking/.test(n)) return "Transport";
  if (/netflix|spotify|apple music|disney|peloton|gym|icloud|pro$|prime|youtube/.test(n)) return "Subscriptions";
  if (/optus|telstra|broadband|energy|origin|agl|insurance|youi|medibank|health cover|water|council/.test(n)) return "Bills";
  if (/kmart|cotton|amazon|jb hi|iconic|bunnings|afterpay|zip|target|big w/.test(n)) return "Shopping";
  return "Fun";
}
