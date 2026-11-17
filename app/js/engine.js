/* ------------------------------------------------------------------
   engine.js — categorisation, insights, predictions, goal plans,
   cash-runway forecast, hardship radar, gamification, the month-by-month
   future simulation and the avatar mood.
   Pure functions over the mock data; no DOM here.
   ------------------------------------------------------------------ */

/* ---------- formatting helpers ---------- */
const money = (n, cents = false) => {
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  return sign + "$" + abs.toLocaleString("en-AU", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
};
const money2 = n => money(n, true);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dateShort = d => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const dateLong = d => `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const monthYear = d => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const monthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = key => MONTHS[parseInt(key.slice(5), 10) - 1];
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const monthsText = n => {
  if (n == null || !isFinite(n)) return "never at this rate";
  const total = Math.round(n);
  const y = Math.floor(total / 12), m = total % 12;
  if (y === 0) return `${m} month${m === 1 ? "" : "s"}`;
  if (m === 0) return `${y} year${y === 1 ? "" : "s"}`;
  return `${y} yr ${m} mo`;
};
const pct = n => Math.round(n * 100) + "%";
const sum = arr => arr.reduce((a, b) => a + b, 0);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const ordinal = n => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
const dateFromMonths = m => addDays(APP.today, Math.round(m * 30.4));
const monthsUntil = d => (d - APP.today) / (30.4 * 86400000);

/* ---------- shared constants ---------- */
const RENT_MOVE_DAY = 3;          // "Ask to move rent to the 3rd": label and event both use this
const PAUSE_DAYS = 42;            // "Pause transfers for 6 weeks"
const HERO_PAYDAY_DEFAULT = 150;  // the usual manual payday transfer to the hero goal
const CARD_RATE = 0.1999;         // only used if the simulation ever runs out of cash and emergency fund
const VAULT_TIERS = [5000, 12000, 18000]; // savings needed for notes, gold bars, treasure chest
const MOOD_WEIGHTS = { goals: 0.40, ef: 0.25, loan: 0.10, cash: 0.25 };
const MOOD_CUTS = { thriving: 0.90, happy: 0.78, okay: 0.62, worried: 0.38 };
const MOOD_LABEL = { thriving: "Thriving", happy: "Happy", okay: "Okay", worried: "Worried", stressed: "Stressed" };

/* ---------- auto transfers ---------- */
const autoMonthly = a => !a ? 0 : a.amount * (a.every === "second" ? 13 : 26) / 12;
const autoLabel = a => !a ? "No auto-save" : `${money(a.amount)} every ${a.every === "second" ? "second payday" : "payday"}`;

/* ---------- analysis window: last 3 complete months before today ---------- */
function analysisWindow(today = APP.today) {
  const keys = [];
  for (let i = 3; i >= 1; i--) keys.push(monthKey(addMonths(new Date(today.getFullYear(), today.getMonth(), 1), -i)));
  return keys; // e.g. ["2026-08","2026-09","2026-10"]
}

function isSpend(t) { return t.amount < 0 && !t.transfer && !t.loan; }

/* ---------- monthly category breakdown ---------- */
function monthlyBreakdown(tx) {
  const byMonth = {};
  for (const t of tx) {
    const k = monthKey(t.date);
    byMonth[k] ??= { key: k, income: 0, spend: 0, transfers: 0, loan: 0, cats: Object.fromEntries(CATEGORIES.map(c => [c.id, 0])) };
    const m = byMonth[k];
    if (t.income) m.income += t.amount;
    else if (t.transfer) m.transfers += -t.amount;
    else if (t.loan) m.loan += -t.amount;
    else if (t.amount < 0) { m.spend += -t.amount; m.cats[t.cat] = (m.cats[t.cat] || 0) + -t.amount; }
  }
  return byMonth;
}

function averages(tx, window) {
  const bm = monthlyBreakdown(tx);
  const months = window.map(k => bm[k]).filter(Boolean);
  const n = months.length || 1;
  const cats = Object.fromEntries(CATEGORIES.map(c => [c.id, sum(months.map(m => m.cats[c.id] || 0)) / n]));
  const income = sum(months.map(m => m.income)) / n;
  const spend = sum(months.map(m => m.spend)) / n;
  const transfers = sum(months.map(m => m.transfers)) / n;
  const loan = sum(months.map(m => m.loan)) / n;
  const essential = sum(CATEGORIES.filter(c => c.essential).map(c => cats[c.id]));
  const discretionary = spend - essential;
  return { cats, income, spend, transfers, loan, essential, discretionary, leftover: income - spend - loan, surplus: income - spend - transfers - loan, months: n };
}

/* ---------- insights: patterns, habits, forgotten subscriptions ---------- */
function detectInsights(tx, window, actions) {
  const inWindow = t => window.includes(monthKey(t.date));
  const w = tx.filter(inWindow);
  const n = window.length;
  const out = [];

  // 1. Subscriptions: total, overlaps, trial conversions
  const subs = RECURRING.filter(r => r.cat === "Subscriptions" && !actions.cancelled.has(r.name));
  const subTotal = sum(subs.map(s => s.amount));
  const groups = {};
  subs.forEach(s => { if (s.group) (groups[s.group] ??= []).push(s); });
  const overlaps = Object.values(groups).filter(g => g.length > 1);
  const trial = subs.find(s => s.trial);
  const overlapCost = sum(overlaps.map(g => g.slice().sort((a, b) => a.amount - b.amount)[0].amount)) + (trial ? trial.amount : 0);
  const trialPaid = trial ? tx.filter(t => t.name === trial.name).length * trial.amount : 0;
  out.push({
    id: "subs", kind: "subscription", icon: "🔁",
    title: `${subs.length} subscriptions cost ${money(subTotal)} a month`,
    amountMonthly: subTotal,
    detail: overlaps.length
      ? `${overlaps.map(g => g.map(s => s.name).join(" and ")).join("; ")} overlap. ${trial ? `${trial.name} converted from a free trial on ${dateShort(trial.since)} and has charged ${money2(trialPaid)} since.` : ""}`
      : "No overlaps left. Nice work.",
    why: `I group recurring charges by what they do. Two music services and two fitness apps are billing you in the same month, and ${trial ? trial.name : "one app"} started charging after a trial with no change in how often you use it. That is ${money2(overlapCost)} a month you could point at the Car Fund without changing your routine.`,
    saving: overlapCost,
    actions: subs.filter(s => (s.group && overlaps.some(g => g.includes(s) && g.slice().sort((a, b) => a.amount - b.amount)[0] === s)) || s.trial)
      .map(s => ({ label: `Cancel ${s.name}`, id: s.name, saving: s.amount })),
  });

  // 2. Weekend delivery habit
  const delivery = w.filter(t => t.delivery);
  const deliveryMonthly = sum(delivery.map(t => -t.amount)) / n;
  const deliveryCount = delivery.length / n;
  const friSat = delivery.filter(t => t.date.getDay() === 5 || t.date.getDay() === 6).length / Math.max(1, delivery.length);
  out.push({
    id: "delivery", kind: "habit", icon: "🛵",
    title: `Food delivery is ${money(deliveryMonthly)} a month`,
    amountMonthly: deliveryMonthly,
    detail: `About ${deliveryCount.toFixed(0)} orders a month, ${pct(friSat)} of them on Friday or Saturday night. Average order ${money2(sum(delivery.map(t => -t.amount)) / Math.max(1, delivery.length))}.`,
    why: `The pattern is tied to the day of the week, not to how busy you are, which usually means it is a habit rather than a need. Halving it to one night a week keeps the treat and frees about ${money(deliveryMonthly / 2)} a month.`,
    saving: deliveryMonthly / 2,
  });

  // 3. Weekday coffee
  const coffee = w.filter(t => t.coffee);
  const coffeeMonthly = sum(coffee.map(t => -t.amount)) / n;
  const coffeeDays = coffee.length / n;
  out.push({
    id: "coffee", kind: "habit", icon: "☕",
    title: `Weekday coffee adds up to ${money(coffeeMonthly)} a month`,
    amountMonthly: coffeeMonthly,
    detail: `${Math.round(coffeeDays)} visits a month to ${MERCHANTS.coffee}. That is ${money(coffeeMonthly * 12)} a year.`,
    why: `Small, frequent spends are the ones people underestimate most. I am not suggesting you quit coffee. Making it at home three days a week would free about ${money(coffeeMonthly * 0.6)} a month and you would barely notice.`,
    saving: coffeeMonthly * 0.6,
  });

  // 4. Payday splurge
  const disc = w.filter(t => isSpend(t) && ["Shopping", "EatingOut", "Fun"].includes(t.cat));
  const discTotal = sum(disc.map(t => -t.amount));
  const afterPay = disc.filter(t => daysSincePayday(t.date) <= 2);
  const share = sum(afterPay.map(t => -t.amount)) / Math.max(1, discTotal);
  out.push({
    id: "payday", kind: "pattern", icon: "📈",
    title: `${pct(share)} of fun spending happens in the 3 days after payday`,
    amountMonthly: sum(afterPay.map(t => -t.amount)) / n,
    detail: `Those 3 days are ${pct(3 / 14)} of the fortnight but carry ${pct(share)} of your shopping, eating out and fun spend.`,
    why: `A payday spike is the most common pattern I see. It is not a problem by itself, but it is why the second week of the fortnight can feel tight. Moving your Car Fund transfer to the morning of payday means the money is gone before the spike, so the spike shrinks on its own.`,
    saving: 0,
  });

  // 5. Positives
  const paydays = tx.filter(t => t.income).length;
  const transfersMade = tx.filter(t => t.transfer).length;
  const bm = monthlyBreakdown(tx);
  const groc = window.map(k => bm[k]?.cats.Groceries || 0);
  const grocAvg = sum(groc) / n;
  const grocSpread = Math.max(...groc) - Math.min(...groc);
  out.push({
    id: "good", kind: "good", icon: "💪",
    title: `You saved on ${transfersMade} of ${paydays} paydays`,
    amountMonthly: 0,
    detail: `Groceries are steady at about ${money(grocAvg)} a month (swing of ${money(grocSpread)}). Rent, bills and the loan always go out on time.`,
    why: `Consistency matters more than the amount. Your savings habit is already there on most paydays, so the plan builds on what you do, not on a reset.`,
    saving: 0,
  });

  // 6. BNPL
  const bnpl = tx.filter(t => /afterpay/i.test(t.name));
  if (bnpl.length) {
    const left = RECURRING.find(r => r.bnpl);
    const remaining = left ? Math.max(0, Math.round((left.until - APP.today) / (30 * 86400000))) + 1 : 0;
    out.push({
      id: "bnpl", kind: "pattern", icon: "🧾",
      title: `Afterpay: ${remaining} instalment${remaining === 1 ? "" : "s"} of $45 to go`,
      amountMonthly: 45,
      detail: `Finishes ${left ? dateShort(left.until) : "soon"}. After that, $45 a month is free to redirect.`,
      why: `Instalments are easy to forget because each one is small. I track the end date so the money can roll straight into your goal instead of quietly disappearing into everyday spending.`,
      saving: 0,
    });
  }

  return out;
}

/* ---------- predictions (closed-form, used by the Goal tab) ---------- */
// A pause skips contributions for the first `pauseMonths` months, then they restart.
function contribFor(m, monthly, pauseMonths = 0) {
  if (pauseMonths <= 0) return monthly;
  const whole = Math.floor(pauseMonths);
  if (m <= whole) return 0;
  if (m === whole + 1) return monthly * (1 - (pauseMonths - whole));
  return monthly;
}

function projectSavings({ months, start, monthly, rate, bonusRate = 0, bonusMonths = 0, pauseMonths = 0 }) {
  const pts = [{ m: 0, date: new Date(APP.today), value: start }];
  let v = start;
  for (let m = 1; m <= months; m++) {
    const r = (rate + (m <= bonusMonths ? bonusRate : 0)) / 12;
    v = v * (1 + r) + contribFor(m, monthly, pauseMonths);
    pts.push({ m, date: addMonths(APP.today, m), value: v });
  }
  return pts;
}

function monthsToTarget({ start, monthly, rate, target, bonusRate = 0, bonusMonths = 0, pauseMonths = 0 }) {
  if (start >= target) return 0;
  let v = start;
  for (let m = 1; m <= 600; m++) {
    const r = (rate + (m <= bonusMonths ? bonusRate : 0)) / 12;
    const before = v;
    v = v * (1 + r) + contribFor(m, monthly, pauseMonths);
    if (v >= target) {
      // fractional month for nicer "days" deltas
      const frac = (target - before) / Math.max(1e-9, v - before);
      return m - 1 + clamp(frac, 0, 1);
    }
  }
  return Infinity;
}

/* ---------- plan levers ---------- */
// `cut: true` steps free money by spending less; the others move spare cash on payday.
function buildLevers(avg, insights, baseMonthly, hasAuto) {
  const delivery = insights.find(i => i.id === "delivery");
  const coffee = insights.find(i => i.id === "coffee");
  const subs = insights.find(i => i.id === "subs");
  const committed = HERO_PAYDAY_DEFAULT * 26 / 12; // $150 every payday
  return [
    { id: "commit", icon: "📅", cut: false, label: `Auto-transfer ${money(HERO_PAYDAY_DEFAULT)} every payday`, sub: `Instead of ${money(baseMonthly)} a month ${hasAuto ? "now" : "when you remember"}`, monthly: Math.max(0, committed - baseMonthly) },
    { id: "subs", icon: "🔁", cut: true, label: subs && subs.actions.length ? `Drop ${subs.actions.length} overlapping subscription${subs.actions.length === 1 ? "" : "s"}` : "Overlapping subscriptions dropped", sub: subs && subs.actions.length ? subs.actions.map(a => a.id).join(", ") : "Nice work", monthly: subs ? subs.saving : 0 },
    { id: "delivery", icon: "🛵", cut: true, label: "Delivery nights: two → one a week", sub: "Keep Friday, cook Saturday", monthly: delivery ? delivery.saving : 0 },
    { id: "coffee", icon: "☕", cut: true, label: "Home coffee three days a week", sub: "Still Elk on Mon and Fri", monthly: coffee ? coffee.saving : 0 },
    { id: "roundups", icon: "🪙", cut: false, label: "Round-ups to Car Fund", sub: "Round each card purchase to the next $5", monthly: 28 },
  ];
}

/* ---------- 6-week pause: which paydays it covers and when it ends ---------- */
function pauseInfo(pots) {
  const hero = pots.goals[0];
  const per = hero.auto ? hero.auto.amount : HERO_PAYDAY_DEFAULT;
  let count = 0, resume = null;
  for (let i = 1; i <= 120 && !resume; i++) {
    const d = addDays(APP.today, i);
    if (!isPayday(d)) continue;
    if (i <= PAUSE_DAYS) count++; else resume = d;
  }
  return { count, keeps: count * per, resume };
}

/* ---------- cash runway: next 60 days of the everyday account ---------- */
function cashRunway(state, days = 60) {
  const { avg, actions, pots } = state;
  const dailyVariable = (avg.cats.Groceries + avg.cats.EatingOut + avg.cats.Transport * 0.6 + avg.cats.Shopping + avg.cats.Fun) / 30.4;
  const hero = pots.goals[0];
  const pts = [];
  let bal = state.balances.everyday;
  let cardOwing = actions.paidCard ? 0 : CUSTOMER.card.owing;
  const events = [];
  for (let i = 0; i <= days; i++) {
    const d = addDays(APP.today, i);
    const dayEvents = [];
    if (i > 0) {
      if (isPayday(d)) {
        const pay = CUSTOMER.payNet; // hours are back to normal after the reduced 5 Nov pay
        bal += pay; dayEvents.push({ name: "Pay", amount: pay });
        const second = (paydayIndex(d) / 14) % 2 === 0;
        for (const g of pots.goals) {
          if (g.saved >= g.target) continue;
          let amt = 0;
          if (g.auto) amt = g.auto.every === "second" && !second ? 0 : g.auto.amount;
          else if (g.id === hero.id) amt = HERO_PAYDAY_DEFAULT;
          // the 6-week pause really ends: transfers restart on the first payday after day 42
          if (g.id === hero.id && actions.pauseTransfers && i <= PAUSE_DAYS) amt = 0;
          if (amt > 0) { bal -= amt; dayEvents.push({ name: `${g.fund} transfer`, amount: -amt }); }
        }
      }
      for (const r of RECURRING) {
        const moved = actions.rentMoved && r.cat === "Rent";
        if ((moved ? RENT_MOVE_DAY : r.day) !== d.getDate()) continue;
        if (r.until && d > r.until) continue;
        if (actions.cancelled.has(r.name)) continue;
        bal -= r.amount; dayEvents.push({ name: moved ? `Rent (moved to the ${ordinal(RENT_MOVE_DAY)})` : r.name, amount: -r.amount });
      }
      for (const l of pots.loans) {
        if (l.balance > 0 && l.day === d.getDate()) { bal -= l.repayment; dayEvents.push({ name: `${l.name} repayment`, amount: -l.repayment }); }
      }
      if (sameDay(d, CUSTOMER.card.due) && cardOwing > 0) { bal -= cardOwing; dayEvents.push({ name: "Credit card autopay", amount: -cardOwing }); cardOwing = 0; }
      bal -= dailyVariable;
    }
    if (i === 0 && actions.coverFromSavings) { bal += actions.coverFromSavings; dayEvents.push({ name: actions.coverSource === "hero" ? "From Car Fund" : "From emergency fund", amount: actions.coverFromSavings }); }
    pts.push({ i, date: d, value: bal, events: dayEvents });
    events.push(...dayEvents.map(e => ({ ...e, date: d })));
  }
  let min = pts[0];
  for (const p of pts) if (p.value < min.value) min = p;
  const firstNeg = pts.find(p => p.value < 0);
  const recovers = firstNeg ? pts.find(p => p.i > firstNeg.i && p.value >= 0) : null;
  return { pts, min, firstNeg, recovers, dailyVariable, events };
}

/* ---------- hardship radar ---------- */
function hardshipCheck(runway, state) {
  if (!runway.firstNeg) return null;
  const shortBy = -runway.min.value;
  const { ef } = state.pots;
  const rentDue = runway.events.find(e => /^rent/i.test(e.name) && sameDay(e.date, runway.firstNeg.date));
  const coverAmt = Math.ceil((shortBy + 150) / 50) * 50;
  const fromEf = ef.saved >= coverAmt;
  const goalDelayMonths = coverAmt / Math.max(1, state.plan.withPlan.monthly);
  const pause = pauseInfo(state.pots);
  // next rent date and where the "move rent" option would put it
  const rent = RECURRING.find(r => r.cat === "Rent");
  let nextRent = null;
  for (let i = 1; i <= 62 && rent && !nextRent; i++) { const d = addDays(APP.today, i); if (d.getDate() === rent.day) nextRent = d; }
  const movedRent = nextRent ? new Date(nextRent.getFullYear(), nextRent.getMonth(), RENT_MOVE_DAY) : null;
  return {
    shortBy,
    from: runway.firstNeg.date,
    to: runway.recovers ? runway.recovers.date : null,
    cause: state.scenario.id === "tough"
      ? "a $1,350 car repair on 12 Nov and a reduced pay on 5 Nov"
      : "spending running ahead of income",
    rentDue: rentDue ? rentDue.date : null,
    options: [
      fromEf
        ? { id: "cover", icon: "🛡️", title: `Use ${money(coverAmt)} from your emergency fund`, sub: `This is what it is for. It covers the gap with a small buffer and leaves the fund at ${pct((ef.saved - coverAmt) / ef.target)}. I can rebuild it at $50 a payday.`, amount: coverAmt, source: "ef" }
        : { id: "cover", icon: "🔁", title: `Move ${money(coverAmt)} from Car Fund`, sub: `Covers the gap with a small buffer. Car date moves about ${Math.round(goalDelayMonths * 4.3)} weeks later. I can set it to pay itself back $50 a payday.`, amount: coverAmt, source: "hero" },
      { id: "pause", icon: "⏸️", title: "Pause Car Fund transfers for 6 weeks", sub: `Keeps ${money(pause.keeps)} in your everyday account over ${pause.count} payday${pause.count === 1 ? "" : "s"}. Transfers restart on ${pause.resume ? dateShort(pause.resume) : "the next payday"}. Streaks are frozen, not lost.` },
      { id: "rent", icon: "📅", title: `Ask to move rent to the ${ordinal(RENT_MOVE_DAY)}`, sub: movedRent ? `Rent would leave on ${dateShort(movedRent)}${isPayday(movedRent) ? ", the day your pay lands," : ""} instead of ${dateShort(nextRent)}. I can draft the message to your agent.` : "I can draft the message to your agent." },
      { id: "human", icon: "🧑‍💼", title: "Talk to Westpac Assist", sub: "A person, not a bot. Payment arrangements, no fees, no effect on your credit score. 8am–8pm." },
    ],
  };
}

/* ---------- gamification ---------- */
const BADGES = [
  { id: "first1k", name: "First $1k", icon: "🥇", hint: "Save your first $1,000" },
  { id: "planner", name: "Planner", icon: "🗺️", hint: "Switch on a plan step" },
  { id: "sleuth", name: "Subscription Sleuth", icon: "🕵️", hint: "Cancel a forgotten subscription" },
  { id: "ontime", name: "On-time ×3", icon: "⏱️", hint: "Three on-time card repayments" },
  { id: "futureme", name: "Sent to Future Me", icon: "📨", hint: "Move a tonight-spend to a goal" },
  { id: "buffer", name: "Buffer Builder", icon: "🛟", hint: "Hold $1,000 spare for a tough month" },
];

function gamify(state) {
  const { tx, actions } = state;
  const hardship = state.calm; // calm mode freezes streaks and offers
  // payday transfer streak (consecutive, most recent first)
  // A reduced pay (hardship) freezes the streak instead of breaking it.
  const paydays = tx.filter(t => t.income && t.amount >= CUSTOMER.payNet).map(t => t.date);
  let transferStreak = 0;
  for (let i = paydays.length - 1; i >= 0; i--) {
    if (tx.some(t => t.transfer && sameDay(t.date, paydays[i]))) transferStreak++; else break;
  }
  const onTime = 2 + (actions.paidCard ? 1 : 0);
  const leversOn = Object.values(actions.levers).filter(Boolean).length;
  const xp = 1240 + actions.cancelled.size * 60 + (actions.paidCard ? 120 : 0) + (actions.sentToFuture > 0 ? 40 : 0) + leversOn * 30;
  const level = 4 + Math.floor(Math.max(0, xp - 1240) / 300);
  const nextXp = 1500 + (level - 4) * 300;
  const earned = new Set(["first1k"]);
  if (leversOn > 0) earned.add("planner");
  if (actions.cancelled.size > 0) earned.add("sleuth");
  if (actions.paidCard) earned.add("ontime");
  if (actions.sentToFuture > 0) earned.add("futureme");
  const bonusUnlocked = onTime >= 3;
  const offers = [
    { id: "bonus", icon: "✨", title: "+0.50% bonus interest for 6 months", req: "3 on-time card repayments in a row", progress: onTime, target: 3, unit: "repayments", unlocked: bonusUnlocked, value: "Worth about $95 on your Car Fund", cta: !actions.paidCard && !hardship ? { label: `Pay ${money(CUSTOMER.card.owing)} card balance now`, id: "payCard" } : null },
    { id: "fee", icon: "💸", title: "$0 account fee for 12 months", req: "Car Fund transfer on 4 paydays in a row", progress: Math.min(4, transferStreak), target: 4, unit: "paydays", unlocked: transferStreak >= 4, value: "Saves $60 a year" },
    { id: "rate", icon: "🚗", title: "Car loan rate review (−0.25%)", req: "Reach $7,000 in Car Fund", progress: Math.round(state.balances.savings), target: 7000, unit: "$", unlocked: state.balances.savings >= 7000, value: "About $180 over a 3-year loan" },
  ];
  return {
    xp, level, nextXp, levelName: ["", "", "", "", "Steady Saver", "Planner", "Momentum", "Future Builder"][Math.min(7, level)] || "Future Builder",
    streaks: [
      { id: "transfer", icon: "📅", name: "Payday transfers", count: transferStreak, unit: "paydays", frozen: !!hardship },
      { id: "ontime", icon: "⏱️", name: "On-time repayments", count: onTime, unit: "in a row", frozen: !!hardship },
      { id: "grocery", icon: "🛒", name: "Under grocery budget", count: 5, unit: "weeks", frozen: !!hardship },
    ],
    badges: BADGES.map(b => ({ ...b, earned: earned.has(b.id) })),
    offers,
    bonusUnlocked,
  };
}

/* ---------- build the whole state ---------- */
function buildState(opts) {
  const scenario = SCENARIOS[opts.scenario] || SCENARIOS.normal;
  const actions = opts.actions;
  const customTx = opts.customTx;
  const A = { ...ASSUMPTIONS, ...(opts.assumptions || {}) };
  const tx = customTx || generateTransactions(scenario);
  const ranked = GOALS.slice().sort((a, b) => a.priority - b.priority);
  const heroDef = ranked[0];

  // Opening balances are chosen so the normal scenario lands on the stated balances today.
  // `savings` is the hero goal's pot (the Car Fund).
  let everyday, savings;
  if (customTx) {
    everyday = CUSTOMER.balances.everyday; savings = heroDef.saved;
  } else {
    const base = generateTransactions(SCENARIOS.normal);
    const openEveryday = CUSTOMER.balances.everyday - sum(base.map(t => t.amount));
    const openSavings = heroDef.saved - sum(base.filter(t => t.transfer).map(t => -t.amount));
    everyday = openEveryday + sum(tx.map(t => t.amount));
    savings = openSavings + sum(tx.filter(t => t.transfer).map(t => -t.amount));
  }
  everyday -= actions.paidCard ? CUSTOMER.card.owing : 0;
  everyday -= actions.sentToFuture;
  savings += actions.sentToFuture;
  const cover = actions.coverFromSavings || 0;
  const coverSource = actions.coverSource || "ef";
  if (cover && coverSource === "hero") savings -= cover;

  // every goal with today's pot balance and its auto transfer (data default, or set in the Main Panel)
  const added = actions.added || {};
  const autos = actions.autos || {};
  const goals = ranked.map((g, i) => {
    const extra = i === 0 ? 0 : (added[g.id] || 0);
    everyday -= extra;
    return { ...g, rank: i, saved: i === 0 ? savings : g.saved + extra, auto: g.id in autos ? autos[g.id] : g.auto };
  });
  const hero = goals[0];

  const window = analysisWindow();
  const avg = averages(tx, window);
  const insights = detectInsights(tx, window, actions);
  const baseMonthly = hero.auto ? autoMonthly(hero.auto) : avg.transfers;
  const levers = buildLevers(avg, insights, baseMonthly, !!hero.auto);
  const leverTotal = sum(levers.filter(l => actions.levers[l.id]).map(l => l.monthly));
  const cancelledSaving = sum(RECURRING.filter(r => actions.cancelled.has(r.name)).map(r => r.amount));

  // emergency fund: target = N months of essential costs (essential categories + loan repayments)
  const loans = LOANS.map(l => ({ ...l }));
  const loanMonthly = sum(loans.filter(l => l.balance > 0).map(l => l.repayment));
  const essentialMonthly = avg.essential + loanMonthly;
  const efSaved = Math.max(0, EMERGENCY_FUND.saved - (cover && coverSource === "ef" ? cover : 0));
  const ef = { name: EMERGENCY_FUND.name, months: EMERGENCY_FUND.months, saved: efSaved, target: EMERGENCY_FUND.months * essentialMonthly, monthsCovered: efSaved / essentialMonthly };
  ef.pct = clamp(ef.saved / ef.target, 0, 1);

  const state = { scenario, actions, tx, balances: { everyday, savings }, window, avg, insights, levers, cancelledSaving, assumptions: A, pots: { goals, ef, loans, essentialMonthly } };

  // goal plan for the hero goal (closed-form; the future slider uses the simulation below)
  const goal = hero;
  const rate = CUSTOMER.savingsRate;
  const bonusUnlocked = 2 + (actions.paidCard ? 1 : 0) >= 3;
  const bonus = bonusUnlocked ? { bonusRate: 0.005, bonusMonths: 6 } : {};
  const pauseMonths = actions.pauseTransfers ? PAUSE_DAYS / 30.4 : 0;
  const currentMonthly = baseMonthly;
  const planMonthly = baseMonthly + leverTotal + cancelledSaving;
  const current = { monthly: currentMonthly, months: monthsToTarget({ start: savings, monthly: currentMonthly, rate, target: goal.target, pauseMonths, ...bonus }) };
  const withPlan = { monthly: planMonthly, months: monthsToTarget({ start: savings, monthly: planMonthly, rate, target: goal.target, pauseMonths, ...bonus }) };
  current.date = isFinite(current.months) ? dateFromMonths(current.months) : null;
  withPlan.date = isFinite(withPlan.months) ? dateFromMonths(withPlan.months) : null;
  const fullMonthly = baseMonthly + sum(levers.map(l => l.monthly)) + cancelledSaving;
  const fullPlan = { monthly: fullMonthly, months: monthsToTarget({ start: savings, monthly: fullMonthly, rate, target: goal.target, pauseMonths, ...bonus }) };
  fullPlan.date = isFinite(fullPlan.months) ? dateFromMonths(fullPlan.months) : null;
  state.plan = { goal, current, withPlan, fullPlan, leverTotal, bonus: bonusUnlocked, progress: savings / goal.target };

  // 60-day runway and hardship
  state.runway = cashRunway(state, 60);
  state.hardship = hardshipCheck(state.runway, state);
  state.calm = !!state.hardship || !!opts.calm;
  state.game = gamify(state);

  // long-range projection (for the Goal tab's time slider)
  state.projection = (months) => ({
    current: projectSavings({ months, start: savings, monthly: currentMonthly, rate, pauseMonths, ...bonus }),
    plan: projectSavings({ months, start: savings, monthly: planMonthly, rate, pauseMonths, ...bonus }),
  });

  // month-by-month future (window panel, main panel, future slider)
  state.track = opts.track === "plan" ? "plan" : "same";
  state.sim = { same: simulate(state, "same", A), plan: simulate(state, "plan", A) };

  return state;
}

/* ==================================================================
   FUTURE SIMULATION
   One month at a time, for 10 years (the slider shows the first 5):
   1. pay grows once a year by the salary growth rate
   2. spending grows every month with inflation
   3. a buffer for random expenses (a share of that month's spending) is deducted
   4. loan repayments come out and reduce the loan
   5. transfers go to goals; every savings pot earns interest
   6. spare cash is not counted as savings (it stays in everyday spending);
      if a month is short, transfers shrink first, then the everyday balance,
      then the emergency fund, and only then does anything land on the card.
   "same" = today's saving continues and nothing else changes.
   "plan" = the plan steps that are switched on, plus a waterfall: when a goal
            is done its money rolls to the next goal, then the emergency fund,
            then extra loan repayments, then a general Future fund.
   ================================================================== */
function simulate(state, track, A, months = 120) {
  const { avg, actions, pots, plan } = state;
  const rate = CUSTOMER.savingsRate;
  const bonusMonths = plan.bonus ? 6 : 0;
  const baseIncome = CUSTOMER.payNet * 26 / 12;
  const cuts = track === "plan" ? sum(state.levers.filter(l => l.cut && actions.levers[l.id]).map(l => l.monthly)) : 0;
  const baseSpend = Math.max(0, avg.spend - state.cancelledSaving - cuts);
  const pauseMonths = actions.pauseTransfers ? PAUSE_DAYS / 30.4 : 0;

  const goals = pots.goals.map((g, i) => ({
    id: g.id, name: g.name, fund: g.fund, type: g.type, cat: g.cat, emoji: g.emoji, target: g.target, due: g.due, dueM: monthsUntil(g.due),
    start: g.saved, saved: Math.min(g.saved, g.target), done: g.saved >= g.target, doneAt: g.saved >= g.target ? 0 : null,
    own: i === 0 ? (track === "plan" ? plan.withPlan.monthly : plan.current.monthly) : autoMonthly(g.auto),
  }));
  const ef = { saved: pots.ef.saved };
  const loans = pots.loans.map(l => ({ ...l, paidOffAt: l.balance <= 0 ? 0 : null }));
  let cash = state.balances.everyday, card = 0, future = 0;
  const cash0 = Math.max(0, cash);
  const essentialsAt = infl => avg.essential * infl + sum(loans.filter(l => l.balance > 0).map(l => l.repayment));

  const shot = (m, flow) => {
    const ess = essentialsAt(Math.pow(1 + A.inflation, m / 12));
    const efTarget = EMERGENCY_FUND.months * ess;
    return {
      m, date: addMonths(APP.today, m), ...flow, cash, card, future, essentials: ess,
      goals: goals.map(g => ({ id: g.id, name: g.name, fund: g.fund, type: g.type, cat: g.cat, emoji: g.emoji, target: g.target, due: g.due, dueM: g.dueM, start: g.start, saved: g.done ? g.target : g.saved, pct: g.done ? 1 : clamp(g.saved / g.target, 0, 1), done: g.done, doneAt: g.doneAt })),
      ef: { saved: ef.saved, target: efTarget, pct: clamp(ef.saved / efTarget, 0, 1), monthsCovered: ef.saved / ess },
      loans: loans.map(l => ({ id: l.id, name: l.name, balance: l.balance, original: l.original, repayment: l.repayment, rate: l.rate, paidOffAt: l.paidOffAt })),
      // completed goals have been bought, so their money is no longer in the vault
      savings: sum(goals.filter(g => !g.done).map(g => g.saved)) + ef.saved + future,
    };
  };

  const out = [shot(0, {})];
  for (let m = 1; m <= months; m++) {
    const infl = Math.pow(1 + A.inflation, m / 12);
    const sal = Math.pow(1 + A.salaryGrowth, Math.floor((m - 1) / 12));
    const income = baseIncome * sal, spend = baseSpend * infl, buffer = A.buffer * spend;
    const r = (rate + (m <= bonusMonths ? 0.005 : 0)) / 12;

    // loans: a month of interest, then the fixed repayment
    let loanPaid = 0, freed = 0;
    for (const l of loans) {
      if (l.balance <= 0) { if (track === "plan") freed += l.repayment; continue; }
      const owing = l.balance * (1 + l.rate / 12);
      const pay = Math.min(l.repayment, owing);
      l.balance = owing - pay; loanPaid += pay;
      if (l.balance < 0.005) { l.balance = 0; l.paidOffAt = m; }
    }

    // transfers planned for this month; on the plan track finished goals and cleared loans keep paying into a pool
    const alloc = goals.map((g, i) => g.done ? 0 : (i === 0 ? contribFor(m, g.own, pauseMonths) : g.own));
    let pool = track === "plan" ? sum(goals.filter(g => g.done).map(g => g.own)) + freed : 0;
    let spare = income - spend - buffer - loanPaid - sum(alloc) - pool, shortfall = 0;
    if (spare < 0) {
      let need = -spare; shortfall = need;
      let t = Math.min(pool, need); pool -= t; need -= t;
      for (let i = alloc.length - 1; i >= 0 && need > 0; i--) { t = Math.min(alloc[i], need); alloc[i] -= t; need -= t; }
      t = Math.min(Math.max(0, cash), need); cash -= t; need -= t;
      t = Math.min(ef.saved, need); ef.saved -= t; need -= t;
      card += need; spare = 0;
    } else {
      // surplus first clears any card debt and rebuilds the everyday cushion; the rest is spent, not saved
      let t = Math.min(card, spare); card -= t; spare -= t;
      const floor = Math.max(cash0, 0.5 * essentialsAt(infl));
      if (cash < floor) { t = Math.min(floor - cash, spare); cash += t; spare -= t; }
    }
    if (card > 0) card *= 1 + CARD_RATE / 12;
    const transfers = sum(alloc) + pool;

    // interest, then contributions (same order as monthsToTarget, so the Goal tab and the slider agree)
    const before = goals.map(g => g.saved);
    goals.forEach((g, i) => { if (!g.done) g.saved = g.saved * (1 + r) + alloc[i]; });
    ef.saved *= 1 + r; future *= 1 + r;

    // overflow from a goal that just crossed its target joins the waterfall (plan only)
    if (track === "plan") goals.forEach(g => { if (!g.done && g.saved > g.target) pool += g.saved - g.target; });
    if (pool > 0) for (const g of goals) {
      if (g.done || g.saved >= g.target) continue;
      const t = Math.min(pool, g.target - g.saved); g.saved += t; pool -= t;
    }
    goals.forEach((g, i) => {
      if (g.done || g.saved < g.target - 1e-6) return;
      const frac = (g.target - before[i]) / Math.max(1e-9, g.saved - before[i]);
      g.doneAt = m - 1 + clamp(frac, 0, 1); g.done = true; g.saved = g.target;
    });
    if (pool > 0) {
      const efTarget = EMERGENCY_FUND.months * essentialsAt(infl);
      if (ef.saved < efTarget) { const t = Math.min(pool, efTarget - ef.saved); ef.saved += t; pool -= t; }
    }
    if (pool > 0) for (const l of loans.slice().sort((a, b) => b.rate - a.rate)) {
      if (l.balance <= 0 || pool <= 0) continue;
      const t = Math.min(pool, l.balance); l.balance -= t; pool -= t;
      if (l.balance < 0.005) { l.balance = 0; l.paidOffAt = m; }
    }
    if (pool > 0) future += pool;

    out.push(shot(m, { income, spend, buffer, loanPaid, transfers, spare, shortfall }));
  }
  // "Today" shows this month's flows
  const f = out[1];
  Object.assign(out[0], { income: f.income, spend: f.spend, buffer: f.buffer, loanPaid: f.loanPaid, transfers: f.transfers, spare: f.spare, shortfall: f.shortfall });
  return out;
}

/* ---------- vault tier and shield state ---------- */
function vaultTier(savings) { return 1 + VAULT_TIERS.filter(t => savings >= t).length; } // 1 coins, 2 notes, 3 gold bars, 4 treasure
function shieldState(p) { return p >= 0.999 ? "full" : p < 0.25 ? "warning" : "partial"; }

/* ---------- mood ----------
   One score from four parts:
   goals (40%)  progress against each goal's own schedule; late or overdue goals score lower
   ef    (25%)  how much of the emergency fund target is funded
   loan  (10%)  how much of the loan has been repaid
   cash  (25%)  today: the lowest point of the 60-day runway against a week of essentials;
                later: the projected everyday balance against two weeks of essentials        */
function goalScheduleScore(g, m) {
  if (g.done) {
    const late = Math.max(0, g.doneAt - g.dueM);
    return late <= 1 ? 1 : clamp(1 - late / 24, 0.4, 1);
  }
  const p0 = g.start / g.target;
  const expected = m >= g.dueM ? 1 : p0 + (1 - p0) * (m / Math.max(1, g.dueM));
  let s = Math.min(1, (g.saved / g.target) / Math.max(0.01, expected));
  if (m > g.dueM) s *= clamp(1 - (m - g.dueM) / 24, 0.4, 1);
  return s;
}

function futureMood(state, monthsAhead = 0) {
  const snaps = state.sim[state.track];
  const m = clamp(Math.round(monthsAhead), 0, snaps.length - 1);
  const s = snaps[m];
  const n = s.goals.length;
  const weights = s.goals.map((g, i) => n - i), wsum = sum(weights) || 1;
  const gScores = s.goals.map(g => goalScheduleScore(g, m));
  const G = n ? sum(gScores.map((x, i) => x * weights[i])) / wsum : 1;
  const E = s.ef.pct;
  const orig = sum(s.loans.map(l => l.original)), owing = sum(s.loans.map(l => l.balance));
  const D = orig > 0 ? 1 - owing / orig : 1;
  const low = m === 0 ? state.runway.min.value : s.cash - s.card;
  const C = clamp(low / (s.essentials / (m === 0 ? 4 : 2)), 0, 1);
  const score = MOOD_WEIGHTS.goals * G + MOOD_WEIGHTS.ef * E + MOOD_WEIGHTS.loan * D + MOOD_WEIGHTS.cash * C;
  let mood = score >= MOOD_CUTS.thriving ? "thriving" : score >= MOOD_CUTS.happy ? "happy" : score >= MOOD_CUTS.okay ? "okay" : score >= MOOD_CUTS.worried ? "worried" : "stressed";
  if (low < 0 || s.card > 0) mood = "stressed";

  // plain-English reasons, strongest first
  const goods = [], bads = [];
  s.goals.forEach((g, i) => {
    const w = weights[i] / wsum;
    if (g.done) {
      const late = g.doneAt - g.dueM;
      if (late <= 1) goods.push({ w: 0.9 * w + 0.3, text: `the ${g.name} is ticked off` });
      else bads.push({ w: 0.5 * w, text: `the ${g.name} arrived ${monthsText(late)} late` });
    } else if (m > g.dueM + 0.5) bads.push({ w: (1 - gScores[i]) * w + 0.3, text: `the ${g.name} is ${monthsText(m - g.dueM)} overdue at ${pct(g.pct)}` });
    else if (gScores[i] < 0.85) bads.push({ w: (1 - gScores[i]) * w + 0.2, text: `the ${g.name} is behind schedule at ${pct(g.pct)}` });
    else goods.push({ w: 0.5 * w, text: `the ${g.name} is on schedule` });
  });
  const efText = `the emergency fund covers ${s.ef.monthsCovered.toFixed(1)} of ${EMERGENCY_FUND.months} months`;
  if (E >= 0.999) goods.push({ w: 0.8, text: "the emergency fund is full" });
  else if (E < 0.25) bads.push({ w: 0.9, text: "the emergency fund is nearly empty" });
  else if (E < 0.7) bads.push({ w: (1 - E) * 0.6, text: efText });
  else goods.push({ w: 0.4, text: efText });
  if (orig > 0 && owing <= 0) goods.push({ w: 0.7, text: "the loan is paid off" });
  else if (orig > 0) bads.push({ w: m === 0 ? 0.1 : 0.15, text: `${money(owing)} of the loan is still owing` });
  if (m === 0 && low < 0) bads.push({ w: 1, text: `your everyday account dips to ${money(low)} before payday` });
  else if (s.card > 0) bads.push({ w: 1, text: `${money(s.card)} has ended up on the credit card` });
  else if (C < 0.5) bads.push({ w: 0.5, text: "the everyday cushion is thin" });
  else goods.push({ w: 0.3, text: "there is a comfortable cushion in your everyday account" });
  goods.sort((a, b) => b.w - a.w); bads.sort((a, b) => b.w - a.w);

  const years = m / 12;
  const who = m === 0 ? "Right now you're" : `In ${Number.isInteger(years) ? years + " year" + (years === 1 ? "" : "s") : monthsText(m)} ${state.track === "plan" ? "with your plan" : "on the same track"}, future you is`;
  const word = { thriving: "thriving", happy: "happy", okay: "doing okay", worried: "worried", stressed: "stressed" }[mood];
  const g1 = goods[0]?.text, g2 = goods[1]?.text, b1 = bads[0]?.text, b2 = bads[1]?.text;
  let sentence;
  if (mood === "thriving" || mood === "happy") sentence = `${who} ${word}: ${[g1, g2].filter(Boolean).join(" and ") || "things are on track"}${b1 ? `, though ${b1}` : ""}.`;
  else if (mood === "okay") sentence = `${who} ${word}: ${g1 || "the basics are covered"}${b1 ? `, but ${b1}` : ""}.`;
  else sentence = `${who} ${word}: ${[b1, b2].filter(Boolean).join(" and ") || "things are tight"}${g1 ? `, but ${g1}` : ""}.`;
  if (state.calm && m === 0) {
    sentence = state.hardship
      ? `This month is tight because of ${state.hardship.cause}, not because of anything you did. I'm here, and so are real people at Westpac Assist.`
      : "The gap is covered and every payment still goes out on time. Things stay calm here until you're back on steady ground.";
  }
  return { mood, label: MOOD_LABEL[mood], score, parts: { goals: G, ef: E, loan: D, cash: C }, goods, bads, sentence };
}

/* ---------- everything the window panel and main panel need at a slider position ---------- */
function futureView(state, years = 0) {
  const m = Math.round(years * 12);
  const snap = state.sim[state.track][m];
  const mood = futureMood(state, m);
  const orig = sum(snap.loans.map(l => l.original)), owing = sum(snap.loans.map(l => l.balance));
  return {
    m, years, track: state.track, snap, mood,
    hero: snap.goals[0], others: snap.goals.slice(1),
    shield: shieldState(snap.ef.pct),
    vaultTier: vaultTier(snap.savings),
    loanRatio: orig > 0 && owing > 0.5 ? clamp(owing / orig, 0, 1) : 0,
    when: years === 0 ? "Today" : `In ${years} year${years === 1 ? "" : "s"} · ${state.track === "plan" ? "With my plan" : "Same track"}`,
  };
}

// When each goal and loan finishes on a track (null = not within the 10 simulated years).
function finishDates(state, track = state.track) {
  const last = state.sim[track].at(-1);
  return {
    goals: Object.fromEntries(last.goals.map(g => [g.id, g.done ? dateFromMonths(g.doneAt) : null])),
    loans: Object.fromEntries(last.loans.map(l => [l.id, l.paidOffAt != null ? addMonths(APP.today, l.paidOffAt) : null])),
  };
}

/* ---------- "what would tonight cost my goal" ---------- */
function daysMovedBy(state, amountOnce) {
  const { savings } = state.balances;
  const { withPlan, goal } = state.plan;
  const rate = CUSTOMER.savingsRate;
  const a = monthsToTarget({ start: savings, monthly: withPlan.monthly, rate, target: goal.target });
  const b = monthsToTarget({ start: savings + amountOnce, monthly: withPlan.monthly, rate, target: goal.target });
  return Math.max(0, Math.round((a - b) * 30.4));
}

/* ---------- compact context for the optional live AI chat ---------- */
function aiContext(state, years = 0) {
  const { avg, plan, balances, game, hardship, insights, pots } = state;
  const fv = futureView(state, years);
  return {
    customer: { firstName: CUSTOMER.first, suburb: CUSTOMER.suburb, today: dateLong(APP.today) },
    balances: { everyday: Math.round(balances.everyday), carFund: Math.round(balances.savings) },
    monthlyAverages: Object.fromEntries(Object.entries(avg.cats).map(([k, v]) => [k, Math.round(v)])),
    income: Math.round(avg.income), spend: Math.round(avg.spend), surplus: Math.round(avg.surplus),
    goal: { name: plan.goal.name, target: plan.goal.target, currentPathMonths: Math.round(plan.current.months), withPlanMonths: Math.round(plan.withPlan.months), planMonthly: Math.round(plan.withPlan.monthly) },
    goals: pots.goals.map(g => ({ name: g.name, saved: Math.round(g.saved), target: g.target, wantedBy: monthYear(g.due), autoSave: autoLabel(g.auto) })),
    emergencyFund: { saved: Math.round(pots.ef.saved), target: Math.round(pots.ef.target), monthsCovered: +pots.ef.monthsCovered.toFixed(1) },
    loans: pots.loans.map(l => ({ name: l.name, balance: Math.round(l.balance), repayment: l.repayment, rate: l.rate })),
    futureView: {
      when: fv.when, mood: fv.mood.label, moodScore: Math.round(fv.mood.score * 100),
      goals: fv.snap.goals.map(g => ({ name: g.name, saved: Math.round(g.saved), target: g.target, done: g.done })),
      emergencyFundPct: Math.round(fv.snap.ef.pct * 100), loanOwing: Math.round(sum(fv.snap.loans.map(l => l.balance))), savings: Math.round(fv.snap.savings),
      assumptions: state.assumptions,
    },
    insights: insights.map(i => ({ title: i.title, detail: i.detail })),
    rewards: game.offers.map(o => ({ title: o.title, progress: `${o.progress}/${o.target} ${o.unit}`, unlocked: o.unlocked })),
    hardship: hardship ? { shortBy: Math.round(hardship.shortBy), from: dateShort(hardship.from), to: hardship.to ? dateShort(hardship.to) : null, cause: hardship.cause } : null,
  };
}
