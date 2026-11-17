/* ------------------------------------------------------------------
   app.js — screens, interactions, scripted AI, demo controls.
   ------------------------------------------------------------------ */

const defaultShow = () => ({ auto: true, avatar: true, hero: true, others: true, shield: true, vault: true, loan: true });
const ui = {
  tab: "home", scenario: "normal", customTx: null, live: false, chat: [], expanded: new Set(), slider: 24, hardshipDone: [], scene: null,
  future: { years: 0, track: "same" },   // the future slider, shared by the window panel and the main panel
  assumptions: { ...ASSUMPTIONS },       // editable in "Show calculation"
  windowShow: defaultShow(), gearOpen: false, moodOpen: false, moodLive: null,
  calcOpen: false, form: null, policies: [],
  avatarSet: "m", // "m" | "f": which avatar set the window shows
  customGoals: [],                  // ids of goals created in the main panel (removed on reset)
  bgOpen: false,                    // background picker on the window page
  questsSeen: new Set(),            // quests already announced as done (so each unlock is toasted once)
  quests: { delivery: 0, coffee: 0 }, // check-ins for the quests that are logged by hand
  searchOpen: false, search: "",    // search on the Future Me page
  goalEdits: {},                    // original copies of built-in goals the customer edited (restored on reset)
};
function defaultActions() {
  return {
    cancelled: new Set(), paidCard: false, sentToFuture: 0,
    levers: { commit: true, subs: false, delivery: false, coffee: false, roundups: false },
    pauseTransfers: false, coverFromSavings: 0, coverSource: "ef", rentMoved: false, humanRequested: false,
    autos: {},  // auto-saves set up in the main panel: { goalId: { amount, every } }
    added: {},  // "Add money now" transfers to goals other than the hero goal
  };
}
let actions = defaultActions();
let S = null;   // engine state
let FV = null;  // the view of the future at the slider position

const $ = sel => document.querySelector(sel);
const view = () => $("#view");

function rebuild() {
  S = buildState({ scenario: ui.scenario, actions, customTx: ui.customTx, calm: ui.scenario === "tough" && ui.hardshipDone.length > 0, assumptions: ui.assumptions, track: ui.future.track });
  FV = futureView(S, ui.future.years);
}

let lastTab = null;
function render() {
  rebuild();
  const v = view();
  const keep = lastTab === ui.tab ? v.scrollTop : 0; // keep the scroll position on same-screen updates
  v.innerHTML = VIEWS[ui.tab]();
  v.scrollTop = keep;
  lastTab = ui.tab;
  wireCharts(v);
  runAnims(v);
  renderSheet();
  const activeTab = TAB_PARENT[ui.tab] || ui.tab;
  $("#appbar-title").textContent = PAGE_TITLES[ui.tab] || APP.name;
  document.querySelectorAll(".tabbar button").forEach(b => b.classList.toggle("active", b.dataset.tab === activeTab));
  $("#appbar-sub").textContent = S.calm ? "Calm mode · let's sort this out" : APP.tagline;
  $("#appbar-ava").textContent = CUSTOMER.first.charAt(0);
  document.body.classList.toggle("hardship", !!S.calm);
  document.body.classList.toggle("on-home", ui.tab === "home"); // Home has its own header, so the app bar is hidden there
  $("#scenario").value = ui.scenario;
  document.querySelectorAll(".scenes button").forEach(b => b.classList.toggle("active", b.dataset.scene === ui.scene));
  checkUnlocks();
}

/* ---------- animate from the previous value (clip widths, shield level) and pop on change ---------- */
const prevAnim = {};
function runAnims(root) {
  root.querySelectorAll("[data-anim]").forEach(el => {
    const key = el.dataset.anim, prop = el.dataset.prop, to = el.dataset.to;
    const from = prevAnim[key];
    if (from != null && from !== to) {
      el.style.transition = "none"; el.style.setProperty(prop, from);
      getComputedStyle(el).getPropertyValue(prop); // commit the starting value before animating
      el.style.transition = "";
    }
    el.style.setProperty(prop, to);
    prevAnim[key] = to;
  });
  root.querySelectorAll("[data-pop]").forEach(el => {
    const key = el.dataset.pop, val = el.dataset.val;
    if (prevAnim[key] != null && prevAnim[key] !== val) el.classList.add("pop");
    prevAnim[key] = val;
  });
}

/* ---------- small UI helpers ---------- */
const whyBox = (id, text) => `
  <button class="why" data-action="why" data-id="${id}">${ui.expanded.has(id) ? "Hide" : "Why?"} <span>${ui.expanded.has(id) ? "▴" : "▾"}</span></button>
  ${ui.expanded.has(id) ? `<div class="why-text"><b>Future Me:</b> ${esc(text)}</div>` : ""}`;

const progressBar = (p, color = "var(--accent)") => `<div class="bar"><i style="width:${clamp(p, 0, 1) * 100}%;background:${color}"></i></div>`;

let toastTimer;
function toast(msg, { confetti = false } = {}) {
  const t = $("#toast");
  t.innerHTML = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 3800);
  if (confetti) burst();
}
function burst() {
  const box = $("#confetti"); box.innerHTML = "";
  const bits = ["🎉", "✨", "🚗", "💸", "⭐", "🎊"];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement("span");
    s.textContent = bits[i % bits.length];
    s.style.left = Math.random() * 100 + "%"; s.style.animationDelay = Math.random() * 0.4 + "s"; s.style.fontSize = 14 + Math.random() * 16 + "px";
    box.appendChild(s);
  }
  setTimeout(() => (box.innerHTML = ""), 2600);
}

// which bottom tab lights up for pages that are not on the tab bar, and the title each page shows in the header
const TAB_PARENT = { main: "home", goal: "more", rewards: "more", chat: "more" };
const PAGE_TITLES = { main: "Future Me", accounts: "Accounts", payments: "Payments", insights: "Insights & tools", more: "More", goal: "Goal plan", rewards: "Rewards", chat: "Ask Future Me" };
const NOT_IN_DEMO = "This part of the banking app is not in the prototype";

// the row of sub-tabs under a page title; only the first is built, the others say so
const subTabs = labels => `<div class="subtabs">${labels.map(([icon, label], i) => `<button class="${i ? "" : "on"}" ${i ? `data-action="stub"` : ""}><span>${icon}</span>${label}</button>`).join("")}</div>`;

/* ================= ACCOUNTS ================= */
function accountsView() {
  const { balances, pots } = S;
  const owing = actions.paidCard ? 0 : CUSTOMER.card.owing;
  const savings = pots.goals.filter(g => g.saved < g.target).map(g => [g.fund, g.saved, g.id]).concat([[pots.ef.name, pots.ef.saved, null]]);
  const credit = balances.everyday + sum(savings.map(s => s[1]));
  const debit = owing + sum(pots.loans.map(l => l.balance));
  const acct = (name, amount, foot, action) => `
    <section class="card acct" ${action}>
      <div class="acct-top"><span>${esc(name)}</span><b>${money2(amount)}</b></div>
      ${foot ? `<div class="acct-foot">${foot}</div>` : ""}
    </section>`;
  return `
    ${subTabs([["💰", "Overview"], ["💳", "Cards"]])}
    <h3 class="grp">Cash</h3>
    ${acct("Westpac Choice", balances.everyday, `<span>💳 Everyday card</span><a data-action="stub">View</a>`, `data-action="open-bank"`)}
    ${savings.map(([name, amt, id]) => acct(`Westpac Life · ${name}`, amt, `<span>On track for ${pct1(CUSTOMER.savingsRate)} p.a. interest</span><a>${id ? "Open goal" : "Details"}</a>`, id ? `data-action="open-goal" data-id="${esc(id)}"` : `data-action="open-bank"`)).join("")}
    <h3 class="grp">Borrowing</h3>
    ${owing > 0 ? acct("Credit card", -owing, `<span>Due ${dateShort(CUSTOMER.card.due)}</span><a>Details</a>`, `data-action="open-bank"`) : ""}
    ${pots.loans.map(l => acct(l.name, -l.balance, `<span>${money(l.repayment)} a month</span><a>Details</a>`, `data-action="open-loans"`)).join("")}
    <div class="totals">
      <div><span>Credit</span><span>${money2(credit)}</span></div>
      <div><span>Debit</span><span>${money2(-debit)}</span></div>
      <div class="total"><b>Total</b><b>${money2(credit - debit)}</b></div>
    </div>
    <section class="card open-acct" data-action="stub"><div><b>Open a new account</b><small>Bank accounts, credit cards, loans, business banking and more</small></div><span>🧾</span></section>
    <div class="sec-row"><h3 class="sec" data-action="open-main"><img class="hico" src="img/coin-generic.png" alt="">Savings goals <span>›</span></h3><a data-action="new-goal">＋ New goal</a></div>
    <div class="goal-strip">
      ${pots.goals.map(g => `
        <section class="card goal-chip" data-action="open-goal" data-id="${esc(g.id)}">
          <div><small>${g.emoji} ${esc(g.name)}</small><b>${money2(g.saved)}</b><span>Target ${money(g.target)}<br>by ${monthYear(g.due)}</span></div>
          ${ring(g.saved / g.target, { size: 62, stroke: 7, color: "#8e2de2", label: pct(Math.min(1, g.saved / g.target)) })}
        </section>`).join("")}
    </div>
    <p class="fine">Prototype accounts for one fictional customer.</p>`;
}

/* ================= PAYMENTS ================= */
function paymentsView() {
  const tiles = [["🔁", "Transfer between accounts", `data-action="open-goal" data-id="${esc(S.pots.goals[0].id)}"`], ["👤", "Pay someone"], ["🆔", "Pay to PayID"], ["🅱️", "BPAY"], ["🌏", "Pay overseas"], ["🏧", "Cardless Cash"], ["💳", "View digital card"], ["⋯", "More ways to pay"]];
  return `
    ${subTabs([["💲", "Pay"], ["☰", "Manage"]])}
    <div class="tiles">${tiles.map(([icon, label, action]) => `<button class="tile" ${action || `data-action="stub"`}><span>${icon}</span>${label}</button>`).join("")}</div>
    <p class="fine">Only "Transfer between accounts" works in this prototype. It opens your goals so you can move money into one.</p>`;
}

/* ================= MORE ================= */
function moreView() {
  const rows = [["🪟", "Your Future Me window", "Goals, quests, the letter and the years ahead", `data-action="open-main"`], ["🚗", "Goal plan", "The plan for your hero goal, step by step", `data-action="tab" data-tab="goal"`], ["🏆", "Rewards", "Streaks, badges and offers", `data-action="tab" data-tab="rewards"`], ["💬", "Ask Future Me", "Questions about your money, answered", `data-action="tab" data-tab="chat"`], ["⚙️", "Settings", "Profile, security and notifications", `data-action="stub"`]];
  return `
    <div class="more-list">${rows.map(([icon, title, sub, action]) => `<button class="more-row" ${action}><span>${icon}</span><div><b>${title}</b><small>${sub}</small></div><i>›</i></button>`).join("")}</div>`;
}

/* ================= HOME ================= */
function homeView() {
  const { balances, plan, runway, hardship, game } = S;
  const head = hardship ? hardshipCard() : ui.hardshipDone.length ? resolvedCard() : `
    <section class="card says">
      <div class="says-head"><span class="avatar">🔮</span><div><b>Future Me says</b><small>Based on your last 3 months</small></div></div>
      <p>${esc(futureSummary())}</p>
      ${whyBox("home-why", `I average your income and spending over ${S.window.map(monthLabel).join(", ")}, keep rent and bills fixed, and roll everything forward month by month with ${pct(CUSTOMER.savingsRate)} p.a. on your Car Fund. The plan line adds the steps you switch on in Goal. It is a projection, not a promise: a pay change or a big bill moves it, and I will tell you when it does.`)}
      <div class="row-actions"><button class="btn primary" data-action="tab" data-tab="goal">See the plan</button><button class="btn ghost" data-action="tab" data-tab="insights">What changed</button></div>
    </section>`;
  return `
    <header class="hero">
      <div class="hero-top">
        <b>Hi ${esc(CUSTOMER.first)}</b>
        <span class="hero-actions"><button class="hero-pill" data-action="tab" data-tab="chat">🎧 Contact us</button><button class="hero-round" data-action="open-main" aria-label="Your profile and whole picture">${esc(CUSTOMER.first.charAt(0))}</button></span>
      </div>
      <button class="hero-search" data-action="tab" data-tab="chat" aria-label="Search or ask a question"><span>🔍</span><span>Try 'When can I get the car?'</span><span>🎤</span></button>
    </header>
    <div class="home-sheet">
    <div class="sec-row"><h3 class="sec" data-action="open-main"><span class="hico" aria-hidden="true">🔮</span>Future Me <span>›</span></h3><small class="fv-when">${esc(FV.when)}</small></div>
    ${windowPanel()}
    ${hardship || ui.hardshipDone.length ? head : ""}
    ${topInsight()}
    <div class="sec-row"><h3 class="sec" data-action="open-bank"><span class="hico" aria-hidden="true">💰</span>Accounts <span>›</span></h3></div>
    <div class="balances">
      <div class="bal" data-action="open-bank"><small>Everyday</small><b>${money2(balances.everyday)}</b><span class="${runway.min.value < 0 ? "neg" : "ok"}">${runway.min.value < 0 ? "dips below $0 on " + dateShort(runway.firstNeg.date) : "lowest in 60 days " + money(runway.min.value)}</span></div>
      <div class="bal" data-action="tab" data-tab="goal"><small>${plan.goal.emoji} ${esc(plan.goal.name)}</small><b>${money2(balances.savings)}</b>${progressBar(plan.progress, "#2a78d6")}<span>${pct(plan.progress)} of ${money(plan.goal.target)}</span></div>
    </div>
    ${hardship || ui.hardshipDone.length ? "" : head}
    <div class="sec-row"><h3 class="sec" data-action="tab" data-tab="goal"><span class="hico" aria-hidden="true">🧰</span>Money tools <span>›</span></h3><a data-action="tab" data-tab="rewards">Rewards</a></div>
    ${runwayCard()}
    ${S.calm ? "" : `
    <section class="card">
      <div class="card-head"><b>Streaks</b><a data-action="tab" data-tab="rewards">Rewards ›</a></div>
      <div class="chips">${game.streaks.map(s => `<span class="chip">${s.icon} ${s.count} ${s.unit} · ${esc(s.name)}</span>`).join("")}</div>
    </section>`}
    <p class="fine">Opt-in. General information, not financial advice. Nudges never block a payment.</p>
    </div>`;
}

// the first insight, shown on Home the way the banking app shows "Top insights"
function topInsight() {
  const list = S.insights || [];
  if (!list.length || S.calm) return "";
  const i = list[0], detail = String(i.detail || "");
  return `
    <div class="sec-row"><h3 class="sec" data-action="tab" data-tab="insights"><span class="hico" aria-hidden="true">💡</span>Top insights <span class="count">${list.length}</span></h3><a data-action="tab" data-tab="insights">See all</a></div>
    <section class="card insight-top" data-action="tab" data-tab="insights">
      <div><span class="unread">Unread</span> <small>${dateShort(APP.today)} ${APP.today.getFullYear()}</small></div>
      <b>${i.icon} ${esc(i.title)}</b>
      <p>${esc(detail.length > 96 ? detail.slice(0, 96).trim() + "…" : detail)}</p>
      <a>Take a look</a>
    </section>`;
}

function futureSummary() {
  const { plan, avg } = S;
  const p3 = S.projection(3).plan.at(-1).value;
  if (plan.leverTotal > 0 && actions.levers.commit && Object.values(actions.levers).filter(Boolean).length > 1 && plan.withPlan.date) {
    return `Your plan is on. Keep it up and the Car Fund hits ${money(p3)} by ${MONTHS[addMonths(APP.today, 3).getMonth()]} and ${money(plan.goal.target)} by ${monthYear(plan.withPlan.date)}. That is ${monthsText(plan.current.months - plan.withPlan.months)} sooner than your current path.`;
  }
  return `About ${money(avg.leftover)} a month is left over after bills and your loan, but only ${money(plan.current.monthly)} of it reaches the Car Fund. The rest tends to get spent. On that path the ${plan.goal.name} is ${monthsText(plan.current.months)} away. With the full plan it could be ${monthsText(plan.fullPlan.months)}.`;
}

function letterCard() {
  return `
    <section class="card letter" id="letter">
      <div class="card-head"><b>📨 A letter from future you</b><small>Weekly</small></div>
      <p>${esc(letter())}</p>
      <div class="row-actions"><button class="btn small primary" data-action="open-quests">See your quests · ${quests().filter(q => q.have >= q.need).length} of ${quests().length} done</button></div>
    </section>`;
}
function letter() {
  const { plan } = S;
  const d = plan.withPlan.date || addMonths(APP.today, 24);
  return `Hi ${CUSTOMER.first}, it's you in ${monthYear(d)}. The ${plan.goal.name} is in the garage and I still get Elk coffee on Mondays. The thing that made the difference wasn't a big sacrifice, it was moving the transfer to payday morning so the money was gone before the weekend. Keep Friday Uber Eats. Skip Saturday's. I've left you a few small quests to get you started. — Future You`;
}

/* ---------- quests from the letter: small habits, tracked in the main panel ---------- */
function quests() {
  const hero = S.pots.goals[0];
  const moved = actions.sentToFuture + Object.values(actions.added).reduce((a, b) => a + b, 0);
  const qs = [
    { id: "payday", icon: "📅", title: "Move your saving to payday morning", why: "Money that leaves before the weekend doesn't get spent.", have: hero.auto ? 1 : 0, need: 1, unit: "auto-save set up", cta: hero.auto ? null : `<button class="btn small" data-action="form-open" data-kind="auto" data-id="${hero.id}">Set up auto-save</button>` },
    { id: "subs", icon: "🔁", title: "Cancel one subscription you don't use", why: "Two of yours overlap. Dropping one is money back every month.", have: Math.min(1, actions.cancelled.size), need: 1, unit: "cancelled", cta: actions.cancelled.size ? null : `<button class="btn small" data-action="tab" data-tab="insights">Find it in Insights</button>` },
    { id: "delivery", icon: "🛵", title: "Skip Saturday delivery for 4 weekends", why: "Keep Friday. Cook Saturday. About $40 saved each time.", have: ui.quests.delivery, need: 4, unit: "weekends", log: "I skipped it this week" },
    { id: "coffee", icon: "☕", title: "Make coffee at home 3 days this week", why: "Still Elk on Monday and Friday.", have: ui.quests.coffee, need: 3, unit: "days", log: "Made one at home" },
    { id: "topup", icon: "💸", title: "Move $50 of spare cash into any goal", why: "Small top-ups add up, and they pull the date closer.", have: Math.min(50, moved), need: 50, unit: "moved", money: true },
  ];
  // rewards: each quest unlocks one of the backgrounds the customer does not have yet; the last one a gold window frame
  const locked = BACKGROUNDS.filter(b => b[0] !== FREE_BG);
  qs.forEach((q, i) => { q.reward = i < locked.length ? { kind: "bg", id: locked[i][0], label: `${locked[i][1]} background` } : { kind: "frame", label: "Gold window frame" }; });
  return qs;
}
function questsCard() {
  const qs = quests(), done = qs.filter(q => q.have >= q.need).length;
  return `
    <h3 class="h3" id="quests"><img class="hico" src="img/quest-highlight.gif" alt="">Quests from future you</h3>
    <section class="card">
      <div class="card-head"><b>📨 From your letter</b><small>${done} of ${qs.length} done</small></div>
      ${qs.map(q => {
        const fin = q.have >= q.need;
        const count = q.money ? `${money(q.have)} of ${money(q.need)} ${q.unit}` : `${q.have} of ${q.need} ${q.unit}`;
        return `
        <div class="quest ${fin ? "done" : ""}">
          <span class="ico">${q.icon}</span>
          <div>
            <b>${esc(q.title)}</b>
            <small>${esc(q.why)}</small>
            ${progressBar(q.have / q.need, fin ? "#1a9c6b" : "#8e2de2")}
            <div class="split"><span>${count}</span>${fin ? `<span class="pill">Done</span>` : q.log ? `<button class="btn small" data-action="quest-log" data-id="${q.id}">＋ ${q.log}</button>` : q.cta || `<span class="fine">Tracked automatically</span>`}</div>
            <div class="reward ${fin ? "got" : ""}">${q.reward.kind === "bg" ? `<img src="img/bg-${q.reward.id}.png" alt="">` : `<i class="frame-chip"></i>`}<span>${fin ? "Unlocked" : "Reward"}: ${q.reward.label}</span>${!fin ? `<em>🔒</em>` : q.reward.kind !== "bg" ? `<em>On</em>` : SCENE_BG === q.reward.id ? `<em>In use</em>` : `<button class="btn small" data-action="bg-set" data-id="${q.reward.id}">Use it</button>`}</div>
          </div>
        </div>`;
      }).join("")}
      <small class="fine">Quests are optional. Some tick themselves off from your account activity; others you log yourself.</small>
    </section>`;
}

function runwayCard() {
  const { runway, hardship } = S;
  const pts = runway.pts.map(p => p.value);
  const chart = lineChart({
    id: "runway", series: [{ name: "Everyday balance", color: hardship ? "#b42318" : "#2a78d6", values: pts, area: true, markers: [{ i: runway.min.i, label: money(runway.min.value), below: runway.min.value < 0 ? false : true }] }],
    yMin: Math.min(0, runway.min.value), zeroLine: true, height: 160,
    xLabel: i => (i % 15 === 0 ? dateShort(runway.pts[i].date) : null),
    tooltip: i => { const p = runway.pts[i]; return `<b>${dateShort(p.date)}</b> · ${money(p.value)}${p.events.length ? "<br>" + p.events.map(e => esc(e.name) + " " + money(e.amount)).join("<br>") : ""}`; },
  });
  const big = runway.events.filter(e => Math.abs(e.amount) >= 500).slice(0, 4);
  return `
    <section class="card">
      <div class="card-head"><b>Next 60 days</b><small>${hardship ? "Current path" : "Looking fine"}</small></div>
      ${chart}
      <div class="events">${big.map(e => `<span>${dateShort(e.date)} · ${esc(e.name)} <b class="${e.amount < 0 ? "neg" : "ok"}">${money(e.amount)}</b></span>`).join("")}</div>
      ${whyBox("runway-why", `I start from today's balance, add your pay every second Thursday, take out rent, subscriptions, bills and the loan repayment on the days they usually land, and spread your everyday spending (about ${money(runway.dailyVariable)} a day) evenly. The low point is the number to watch.`)}
    </section>`;
}

/* ================= WINDOW PANEL (top of Home): the whole account, no numbers ================= */
function windowPanel() {
  return `
    <section class="card window">
      <div class="scene-wrap" data-fv="scene">${windowScene()}</div>
      <div class="future quick">${yearSlider()}</div>
      <button class="win-note" data-action="open-main" data-fv="home-note">${homeNote()}</button>
    </section>`;
}
const homeNote = () => `<b>${esc(moodTitle())}</b><span>Open your window ›</span>`;

// one place for the options every copy of the window scene shares
const sceneOpts = (uid, more = {}) => {
  if (!unlockedBgs().includes(SCENE_BG)) SCENE_BG = FREE_BG; // a background whose quest is no longer done falls back to the free one
  return { show: ui.windowShow, calm: S.calm, uid, insured: INSURANCES.concat(ui.policies).length > 0, quests: quests().filter(q => q.have < q.need).length, frame: frameUnlocked(), ...more };
};

const windowScene = () => sceneSvg(FV, sceneOpts("w", { tapAvatar: false })); // on Home any tap opens the window page

function gearMenu() {
  const show = ui.windowShow;
  const items = [["avatar", "Avatar"], ["hero", "Hero goal scene"], ["others", "Other goals"], ["shield", "Protection shields"], ["vault", "Vault"], ["loan", "Loan"]];
  return `
    <div class="gear-menu">
      <div class="card-head"><b>Customise what's shown</b><button class="btn small ${show.auto ? "done" : ""}" data-action="win-auto">${show.auto ? "✓ Automatic" : "Automatic"}</button></div>
      <div class="toggles">${items.map(([k, label]) => `<label class="toggle"><input type="checkbox" data-action="win-toggle" data-id="${k}" ${show[k] ? "checked" : ""}> ${label}</label>`).join("")}</div>
      <div class="card-head" style="margin-top:8px"><b>Avatar</b><span class="avset">${[["m", "Male"], ["f", "Female"]].map(([k, label]) => `<button class="btn small ${ui.avatarSet === k ? "done" : ""}" data-action="win-avatar" data-id="${k}">${label}</button>`).join("")}</span></div>
    </div>`;
}

// Calm mode never labels the customer "Stressed" or "Worried".
const moodTitle = () => S.calm && (FV.mood.mood === "stressed" || FV.mood.mood === "worried") ? "Here with you" : FV.mood.label;
const moodKey = () => `${ui.scenario}|${ui.future.years}|${ui.future.track}|${Math.round(FV.mood.score * 1000)}`;

function moodNote() {
  if (!ui.moodOpen) return "";
  const live = ui.moodLive && ui.moodLive.key === moodKey() ? ui.moodLive.text : null;
  return `<div class="mood-note ${S.calm ? "calm" : ""}"><b>${esc(moodTitle())}</b><span>${esc(live || FV.mood.sentence)}</span>${live ? `<small>Live AI</small>` : ""}</div>`;
}

async function fetchMoodLive() {
  if (!ui.live) return;
  const key = moodKey();
  try {
    const r = await fetch("http://localhost:8787/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: `In one plain sentence of at most 30 words, tell me why my money avatar looks "${moodTitle()}" (${FV.when}). Use the futureView numbers in the snapshot. Give the reason only, no advice.` }], context: aiContext(S, ui.future.years) }),
    });
    if (!r.ok) return;
    const text = (await r.json()).reply;
    if (text && key === moodKey()) { ui.moodLive = { key, text }; refreshFuture(); }
  } catch (e) { /* stay on the scripted sentence */ }
}

/* ---------- future slider, shared by both panels ---------- */
function planNote() {
  const on = Object.values(actions.levers).filter(Boolean).length, all = S.levers.length;
  return ui.future.track === "plan"
    ? `${on} of ${all} plan steps on${on < all ? ` · <a data-action="tab" data-tab="goal">add steps in Goal</a>` : ""}. Finished goals roll on to the next one.`
    : "Same track: you keep saving what you save today and nothing else changes.";
}

// the slider on its own: also used under the window on Home for a quick look ahead
const yearSlider = () => `
      <input type="range" class="fut-range" min="0" max="5" step="1" value="${ui.future.years}" data-action="future-years" aria-label="Years ahead" title="Drag to look up to 5 years ahead">
      <div class="ticks"><span>Today</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5 yrs</span></div>`;

function futureControls() {
  const t = ui.future.track;
  return `
    <div class="future">${yearSlider()}
      <div class="fut-row">
        <div class="seg" role="group" aria-label="Which track">
          <button data-action="future-track" data-track="same" class="${t === "same" ? "on" : ""}">Same track</button>
          <button data-action="future-track" data-track="plan" class="${t === "plan" ? "on" : ""}">With my plan</button>
        </div>
        <button class="btn small ghost" data-action="calc-open">Show calculation</button>
      </div>
      <small class="plan-note">${planNote()}</small>
    </div>`;
}

// Re-draw only the parts that depend on the slider, so the slider itself stays put while it is dragged.
const fvParts = {
  scene: windowScene,
  "scene-main": () => sceneSvg(FV, sceneOpts("m")),
  note: moodNote,
  "home-note": homeNote,
  "main-top": () => mainTop(),
  "main-body": () => mainBody(),
  "goal-proj": () => goalProjection(),
  "quest-btn": () => questButton(),
};
// the text nodes that carry a number (outside the picture): these get a soft highlight when the slider changes them
const valueLeaves = root => [...root.querySelectorAll("b, span, small, p, .bigline")].filter(el => !el.children.length && !el.closest("svg") && /\d/.test(el.textContent));
function refreshFuture({ flash = false } = {}) {
  FV = futureView(S, ui.future.years);
  document.querySelectorAll("[data-fv]").forEach(el => {
    const before = flash ? valueLeaves(el).map(x => x.textContent) : null;
    el.innerHTML = fvParts[el.dataset.fv](); wireCharts(el);
    if (!before) return;
    const after = valueLeaves(el), same = after.length === before.length, seen = new Set(before);
    after.forEach((x, i) => { if (same ? x.textContent !== before[i] : !seen.has(x.textContent)) x.classList.add("chg"); });
  });
  document.querySelectorAll(".fv-when").forEach(el => {
    if (el.textContent === FV.when) return;
    el.textContent = FV.when;
    if (flash) { el.classList.remove("chg"); void el.offsetWidth; el.classList.add("chg"); }
  });
  document.querySelectorAll(".fut-range").forEach(el => { if (+el.value !== ui.future.years) el.value = ui.future.years; });
  document.querySelectorAll(".seg button").forEach(b => b.classList.toggle("on", b.dataset.track === ui.future.track));
  document.querySelectorAll(".plan-note").forEach(el => (el.innerHTML = planNote()));
  runAnims(document);
  if (ui.calcOpen) updateCalc();
}

/* ================= MAIN PANEL: the window, with numbers ================= */
function mainView() {
  return `
    <button class="back" data-action="tab" data-tab="home">‹ Home</button>
    ${ui.searchOpen ? searchBox() : ""}
    <section class="greet"><h2>Your whole picture</h2><p class="fv-when">${esc(FV.when)}</p></section>
    <section class="card mainhead">
      <div class="card-head"><b>Your window</b><span class="win-right"><button class="gear" data-action="bg-edit" aria-label="Change window background" title="Change window background" aria-expanded="${ui.bgOpen}">✎</button><button class="gear" data-action="win-gear" aria-label="Customise what's shown" title="Customise what's shown" aria-expanded="${ui.gearOpen}">⚙</button></span></div>
      ${ui.bgOpen ? bgPicker() : ""}${ui.gearOpen ? gearMenu() : ""}
      <div class="scene-wrap mini" data-fv="scene-main">${sceneSvg(FV, sceneOpts("m"))}</div>
      ${futureControls()}
      <div data-fv="main-top">${mainTop()}</div>
      <small class="fine hint">Drag the slider to look ahead. Tap anything in the picture to jump to it: a goal, the safe, the loan, a shield, the quest icon or your avatar.</small>
    </section>
    ${S.calm ? "" : letterCard()}
    <div data-fv="main-body">${mainBody()}</div>
    <p class="fine">Projections are estimates from your last three months and the assumptions in Show calculation. General information, not financial advice.</p>`;
}

// quest icon in the Future Me toolbar, with the number still to do
function questButton() {
  if (S.calm) return "";
  const open = quests().filter(q => q.have < q.need).length, tip = open ? `Quests from future you · ${open} to do` : "Quests from future you · all done";
  return `<button class="gear quest-btn" data-action="open-quests" aria-label="${tip}" title="${tip}"><img src="img/quest-highlight.gif" alt="">${open ? `<i>${open}</i>` : ""}</button>`;
}

/* ---------- search on the Future Me page: goals, loans, balances, protection, quests ---------- */
function searchIndex() {
  const items = [];
  S.pots.goals.forEach(g => items.push({ icon: g.emoji || "🎯", label: g.name, sub: `Goal · ${money(g.saved)} of ${money(g.target)}`, id: "goal-" + g.id, words: [g.name, g.fund, g.desc, g.cat, g.type, "goal saving"] }));
  items.push({ icon: "＋", label: "Create a new goal", sub: "Pick an icon, a target and a date", id: "new-goal", words: ["new add create goal"] });
  items.push({ icon: "🏦", label: "Bank balance", sub: "Everyday and savings", id: "bank", words: ["bank balance everyday savings account cash money vault safe"] });
  FV.snap.loans.forEach(l => items.push({ icon: "⛓️", label: l.name, sub: `Loan · ${money(l.balance)} left`, id: "loans", words: [l.name, "loan debt repayment owing"] }));
  items.push({ icon: "🛡️", label: "Emergency fund", sub: `${money(FV.snap.ef.saved)} of ${money(FV.snap.ef.target)}`, id: "ef", words: ["emergency fund rainy day safety shield protection"] });
  INSURANCES.concat(ui.policies).forEach(p => items.push({ icon: p.icon, label: p.name, sub: `Insurance · ${p.provider}`, id: "protection", words: [p.name, p.provider, "insurance policy cover protection shield"] }));
  if (!S.calm) {
    items.push({ icon: "📨", label: "Letter from future you", sub: "This week's letter", id: "letter", words: ["letter future you weekly"] });
    quests().forEach(q => items.push({ icon: q.icon, label: q.title, sub: `Quest · ${q.have >= q.need ? "done" : "reward: " + q.reward.label}`, id: "quests", words: [q.title, q.reward.label, "quest reward habit"] }));
  }
  items.push({ icon: "🙂", label: "How future you is feeling", sub: FV.mood.label, id: "mood", words: ["mood avatar feeling", FV.mood.label] });
  return items;
}
function searchResults() {
  const terms = ui.search.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return `<small class="fine">Try "car", "loan", "emergency" or "quest".</small>`;
  const hits = searchIndex().filter(it => { const hay = it.words.filter(Boolean).join(" ").toLowerCase(); return terms.every(t => hay.includes(t)); }).slice(0, 8);
  if (!hits.length) return `<small class="fine">Nothing on this page matches "${esc(ui.search)}".</small>`;
  return hits.map(it => `<button type="button" class="search-hit" data-action="jump" data-id="${esc(it.id)}"><span class="ico">${it.icon}</span><span><b>${esc(it.label)}</b><small>${esc(it.sub)}</small></span><em>›</em></button>`).join("");
}
function searchBox() {
  return `
    <section class="card search-card">
      <div class="search-box"><span>🔍</span><input type="search" id="fm-search" data-search value="${esc(ui.search)}" placeholder="Search goals, loans, quests…" aria-label="Search Future Me" autocomplete="off"><button class="gear" data-action="search" aria-label="Close search" title="Close search">✕</button></div>
      <div id="search-results">${searchResults()}</div>
    </section>`;
}

/* ---------- window background: random on the first visit, then remembered until the customer changes it ---------- */
const BG_KEY = "futureme.windowBackground";
const FREE_KEY = "futureme.freeBackground";
let FREE_BG = "abstract"; // the one background every customer starts with; the others are quest rewards
function loadBackground() {
  const valid = id => BACKGROUNDS.some(b => b[0] === id);
  let chosen = null, free = null;
  try { chosen = localStorage.getItem(BG_KEY); free = localStorage.getItem(FREE_KEY); } catch (e) { /* storage blocked: pick again each visit */ }
  if (!valid(free)) free = valid(chosen) ? chosen : BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)][0];
  if (!valid(chosen)) chosen = free;
  try { localStorage.setItem(FREE_KEY, free); localStorage.setItem(BG_KEY, chosen); } catch (e) { /* ignore */ }
  FREE_BG = free; SCENE_BG = chosen;
}
const unlockedBgs = () => [FREE_BG].concat(quests().filter(q => q.have >= q.need && q.reward.kind === "bg").map(q => q.reward.id));
const frameUnlocked = () => quests().some(q => q.reward.kind === "frame" && q.have >= q.need);
// announce each newly finished quest's reward once
function checkUnlocks() {
  const fresh = quests().filter(q => q.have >= q.need && !ui.questsSeen.has(q.id));
  fresh.forEach(q => ui.questsSeen.add(q.id));
  if (fresh.length) toast(`🎁 Quest done · unlocked: ${fresh.map(q => q.reward.label).join(", ")}`, { confetti: true });
  return fresh.length > 0;
}
function setBackground(id) {
  if (!BACKGROUNDS.some(b => b[0] === id)) return;
  SCENE_BG = id;
  try { localStorage.setItem(BG_KEY, id); } catch (e) { /* ignore */ }
}
function bgPicker() {
  return `
    <div class="gear-menu">
      <div class="card-head"><b>Window background</b><small>${unlockedBgs().length} of ${BACKGROUNDS.length} unlocked</small></div>
      <div class="bg-pick">${BACKGROUNDS.map(([id, label]) => { const open = unlockedBgs().includes(id); return `<button type="button" class="${SCENE_BG === id ? "on" : ""} ${open ? "" : "locked"}" data-action="bg-set" data-id="${id}" aria-pressed="${SCENE_BG === id}" aria-label="${label}${open ? "" : ", locked"}"><img src="img/bg-${id}.png" alt=""><span>${open ? label : "🔒 " + label}</span></button>`; }).join("")}</div>
      <small class="fine">Finish quests to unlock more backgrounds.</small>
    </div>`;
}

function mainTop() {
  return `
    <div class="main-top" id="mood">
      ${avatarSvg(FV.mood.mood, { size: 62, calm: S.calm })}
      <div>
        <b>${esc(moodTitle())}</b>
        <p>${esc(FV.mood.sentence)}</p>
        ${S.calm ? `<button class="btn small" data-action="calm-talk">Want to talk to someone?</button>` : ""}
      </div>
    </div>`;
}

const POLICY_TYPES = [["home", "🏠", "Home and contents"], ["life", "❤️", "Life"], ["income", "💼", "Income protection"], ["pet", "🐾", "Pet"], ["travel", "✈️", "Travel"], ["other", "📄", "Other"]];

function mainBody() {
  const s = FV.snap, today = ui.future.years === 0;
  const fmt = today ? money2 : n => money(n);
  const fin = finishDates(S);
  const row = (label, value, cls = "") => `<div class="mrow"><span>${label}</span><b class="${cls}">${fmt(value)}</b></div>`;

  const bank = `
    <section class="card" id="bank">
      <div class="card-head"><b>Bank balance</b><small>${today ? "Everyday + savings" : "Projected"}</small></div>
      <div class="bigline">${fmt(s.cash + s.savings - s.card)}</div>
      ${row("Everyday", s.cash)}
      ${s.goals.filter(g => !g.done).map(g => row(`${g.emoji} ${esc(g.fund)}`, g.saved)).join("")}
      ${row("🛡️ Emergency fund", s.ef.saved)}
      ${s.future > 0.5 ? row("🌱 Future fund", s.future) : ""}
      ${s.card > 0.5 ? row("💳 Credit card", -s.card, "neg") : ""}
      ${s.goals.some(g => g.done) ? `<small class="fine">Finished goals have been bought, so that money has left the vault.</small>` : ""}
    </section>`;

  const goals = s.goals.map(g => {
    const pot = S.pots.goals.find(x => x.id === g.id);
    const finDate = fin.goals[g.id];
    const late = finDate ? monthsUntil(finDate) - g.dueM : null;
    const onTrack = g.done
      ? `<span class="ok">Done ${monthYear(dateFromMonths(g.doneAt))}</span>`
      : !finDate ? `<span class="neg">Not reached at this rate</span>`
      : late > 1 ? `<span class="neg">On track for ${monthYear(finDate)} · ${monthsText(late)} late</span>`
      : `<span class="ok">On track for ${monthYear(finDate)}</span>`;
    const hero = pot.rank === 0;
    const autoTxt = pot.auto ? `Auto-save: ${autoLabel(pot.auto)}` : hero ? `No auto-save · about ${money(S.plan.current.monthly)} a month by hand` : "No auto-save yet";
    const planTxt = hero && ui.future.track === "plan" && S.plan.withPlan.monthly > S.plan.current.monthly + 1 ? ` · plan adds ${money(S.plan.withPlan.monthly - S.plan.current.monthly)} a month` : "";
    const f = ui.form && ui.form.id === g.id ? ui.form : null;
    return `
      <section class="card goalcard ${g.done ? "done" : ""}" id="goal-${esc(g.id)}">
        <div class="ins-head"><span class="ico ${g.done ? "" : "grey"}">${pot.type === "other" ? `<img src="img/coin-${coinKey(pot)}.png" alt="">` : g.emoji}</span><div><b>${esc(g.name)}</b><small>${esc(pot.desc || "")}</small></div>${g.done ? `<span class="pill">Completed</span>` : hero ? `<span class="pill hero">Hero goal</span>` : ""}</div>
        ${progressBar(g.pct, g.done ? "#1a9c6b" : "#2a78d6")}
        <div class="split"><span><b>${money(g.saved)}</b> of ${money(g.target)}</span><span>${pct(g.pct)}</span></div>
        <div class="split"><span>Wanted by ${monthYear(g.due)}</span>${onTrack}</div>
        <small class="auto-line">${esc(autoTxt + planTxt)}</small>
        <div class="row-actions">
          <button class="btn small ${f && f.kind === "auto" ? "primary" : ""}" data-action="form-open" data-kind="auto" data-id="${g.id}">${pot.auto ? "Change auto-save" : "Set up auto-save"}</button>
          <button class="btn small ${f && f.kind === "add" ? "primary" : ""}" data-action="form-open" data-kind="add" data-id="${g.id}">Add money now</button>
          ${g.done ? "" : `<button class="btn small ${f && f.kind === "edit" ? "primary" : ""}" data-action="form-open" data-kind="edit" data-id="${g.id}" title="Change the name, target, date or icon">✎ Edit</button>`}
        </div>
        ${f ? goalForm(f, pot) : ""}
      </section>`;
  }).join("");

  const loans = s.loans.map(l => {
    const paid = l.balance <= 0.5;
    const payoff = fin.loans[l.id];
    return `
      <section class="card">
        <div class="ins-head"><span class="ico">⛓️</span><div><b>${esc(l.name)}</b><small>${pct1(l.rate)} p.a. · ${money(l.repayment)} a month</small></div>${paid ? `<span class="pill">Paid off</span>` : ""}</div>
        ${progressBar(1 - l.balance / l.original, paid ? "#1a9c6b" : "#6250d6")}
        <div class="split"><span><b>${money(l.balance)}</b> left of ${money(l.original)}</span><span>${pct(1 - l.balance / l.original)} repaid</span></div>
        <div class="split"><span>Monthly repayment ${money(l.repayment)}</span><span class="${paid ? "ok" : ""}">${paid ? "Paid off " + monthYear(addMonths(APP.today, l.paidOffAt)) : payoff ? "Payoff " + monthYear(payoff) : "Payoff after 10 years"}</span></div>
      </section>`;
  }).join("");

  const shieldText = { full: ["Fully funded", "ok"], partial: ["Part funded", ""], warning: ["Below a quarter. Worth topping up first.", "neg"] }[FV.shield];
  const policies = INSURANCES.concat(ui.policies);
  const pf = ui.form && ui.form.kind === "policy" ? ui.form : null;
  const protection = `
    <section class="card">
      <div class="card-head"><b>Insurances and emergency fund</b><small>${today ? "Today" : "Projected"}</small></div>
      <div class="prot" id="ef">
        ${shieldSvg(FV.shield, s.ef.pct, 30)}
        <div>
          <b>Emergency fund</b>
          <small>${money(s.ef.saved)} of ${money(s.ef.target)} · covers ${s.ef.monthsCovered.toFixed(1)} of ${EMERGENCY_FUND.months} months</small>
          ${progressBar(s.ef.pct, FV.shield === "warning" ? "#f4b400" : "#35b384")}
          <small class="${shieldText[1]}">${shieldText[0]}</small>
        </div>
      </div>
      <small class="fine">Target is ${EMERGENCY_FUND.months} months of rent, groceries, transport, bills and loan repayments.</small>
      ${policies.map(p => `
        <div class="prot">
          <span class="ico">${p.icon}</span>
          <div>
            <b>${esc(p.name)} <span class="tag ${p.source === "Westpac" ? "wbc" : ""}">${p.source === "Westpac" ? "Westpac" : "Added manually"}</span></b>
            <small>${esc(p.provider)} · ${money(p.premium)} a ${p.per} · renews ${dateShort(p.renewal)} ${p.renewal.getFullYear()}</small>
          </div>
        </div>`).join("")}
      <div class="row-actions"><button class="btn small ${pf ? "primary" : ""}" data-action="form-open" data-kind="policy" data-id="policy">＋ Add a policy</button></div>
      ${pf ? policyForm(pf) : ""}
      <small class="fine">Add policies you hold outside Westpac so every renewal is in one place.</small>
    </section>`;

  const nf = ui.form && ui.form.kind === "goal" ? ui.form : null;
  const newGoal = `
    <section class="card" id="new-goal">
      <div class="row-actions"><button class="btn small ${nf ? "primary" : ""}" data-action="form-open" data-kind="goal" data-id="newgoal">＋ New goal</button></div>
      ${nf ? newGoalForm(nf) : `<small class="fine">Pick a picture or an icon. It appears in your window in grey and fills with colour as you save.</small>`}
    </section>`;
  return `${bank}${S.calm ? "" : questsCard()}<h3 class="h3"><img class="hico" src="img/coin-generic.png" alt="">Goals</h3>${goals}${newGoal}<h3 class="h3" id="loans"><img class="hico" src="img/loan-icon.png" alt="">Loan repayments</h3>${loans}<h3 class="h3" id="protection"><img class="hico" src="img/shield-insurance-on.png" alt="">Protection</h3>${protection}`;
}

function goalForm(f, pot) {
  if (f.kind === "edit") return newGoalForm(f, pot);
  if (f.kind === "auto") {
    let next = null;
    for (let i = 1; i <= 14 && !next; i++) { const d = addDays(APP.today, i); if (isPayday(d)) next = d; }
    return `
      <div class="inline-form">
        <label>Amount <span class="money-in">$<input type="number" min="5" step="5" value="${esc(f.amount)}" data-form="amount" aria-label="Auto-save amount"></span></label>
        <label>When <select data-form="every" aria-label="Which payday"><option value="payday" ${f.every === "payday" ? "selected" : ""}>Every payday</option><option value="second" ${f.every === "second" ? "selected" : ""}>Every second payday</option></select></label>
        <small class="fine">Leaves your account the morning pay lands. Next payday is ${dateShort(next)}.</small>
        <div class="row-actions"><button class="btn primary small" data-action="form-save">Save auto-save</button>${pot.auto ? `<button class="btn small" data-action="form-remove">Remove</button>` : ""}<button class="btn ghost small" data-action="form-cancel">Cancel</button></div>
      </div>`;
  }
  return `
    <div class="inline-form">
      <label>Amount <span class="money-in">$<input type="number" min="1" step="10" value="${esc(f.amount)}" data-form="amount" aria-label="Amount to move"></span></label>
      <small class="fine">Moves from Everyday (${money2(S.balances.everyday)}) to ${esc(pot.fund)} today.</small>
      <div class="row-actions"><button class="btn primary small" data-action="form-save">Move money</button><button class="btn ghost small" data-action="form-cancel">Cancel</button></div>
    </div>`;
}

// picture goals get their own illustration in the window (img/goal-<id>.png) instead of a coin
const GOAL_PICTURES = [["house", "House", "🏠"], ["car", "Car", "🚗"], ["bike", "Bike", "🚲"]];
const GOAL_ICONS = [["electronics", "Electronics", "💻"], ["entertainment", "Entertainment", "🎟️"], ["travel", "Travel", "✈️"], ["education", "Education", "🎓"], ["gift", "Gift", "🎁"], ["tech", "Phone and tech", "📱"], ["home", "Home", "🏠"], ["health", "Health", "🩺"], ["wedding", "Wedding", "💍"], ["baby", "Baby", "🍼"], ["pet", "Pet", "🐾"], ["generic", "Something else", "⭐"]];
const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// which picker entry a goal currently uses ("" for the holiday, which has its own picture)
const goalIconId = g => HERO_GOAL_TYPES.has(g.type) ? g.type : g.type === "vacation" ? "" : coinKey(g);
// the same form creates a goal and edits one (pot is the goal being edited)
function newGoalForm(f, pot = null) {
  return `
    <div class="inline-form">
      <label>Icon${pot && pot.type === "vacation" && !f.cat ? ` <small class="fine">Holiday picture · pick one below to change it</small>` : ""}</label>
      <div class="pic-pick">${GOAL_PICTURES.map(([id, label]) => `<button type="button" class="${f.cat === id ? "on" : ""}" data-action="form-icon" data-id="${id}" aria-pressed="${f.cat === id}"><img src="img/goal-${id}.png" alt=""><span>${label}</span></button>`).join("")}</div>
      <div class="icon-pick">${GOAL_ICONS.map(([id, label]) => `<button type="button" class="${f.cat === id ? "on" : ""}" data-action="form-icon" data-id="${id}" title="${label}" aria-label="${label}" aria-pressed="${f.cat === id}"><img src="img/coin-${id}.png" alt=""></button>`).join("")}</div>
      <label>Name <input type="text" data-form="name" value="${esc(f.name)}" placeholder="e.g. New camera" aria-label="Goal name"></label>
      <label>Target <span class="money-in">$<input type="number" min="50" step="50" value="${esc(f.target)}" data-form="target" aria-label="Target amount"></span></label>
      <label>Wanted by <input type="date" data-form="due" value="${esc(f.due)}" aria-label="Wanted by date"></label>
      ${pot ? `
      <small class="fine">${money(pot.saved)} saved so far stays in this goal.</small>
      <div class="row-actions"><button class="btn primary small" data-action="form-save">Save changes</button>${ui.customGoals.includes(pot.id) ? `<button class="btn small" data-action="goal-delete" data-id="${esc(pot.id)}">Delete goal</button>` : ""}<button class="btn ghost small" data-action="form-cancel">Cancel</button></div>` : `
      <label>Auto-save each payday <span class="money-in">$<input type="number" min="0" step="5" value="${esc(f.auto)}" data-form="auto" aria-label="Auto-save each payday, optional"></span></label>
      <small class="fine">Auto-save is optional. Leave it at 0 and add money by hand whenever you like.</small>
      <div class="row-actions"><button class="btn primary small" data-action="form-save">Create goal</button><button class="btn ghost small" data-action="form-cancel">Cancel</button></div>`}
    </div>`;
}
function policyForm(f) {
  return `
    <div class="inline-form">
      <label>Type <select data-form="ptype" aria-label="Policy type">${POLICY_TYPES.map(([id, , label]) => `<option value="${id}" ${f.ptype === id ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      <label>Insurer <input type="text" data-form="provider" value="${esc(f.provider)}" placeholder="e.g. NRMA" aria-label="Insurer"></label>
      <label>Premium <span class="money-in">$<input type="number" min="1" step="1" value="${esc(f.premium)}" data-form="premium" aria-label="Premium"></span>
        <select data-form="per" aria-label="Premium period"><option value="month" ${f.per === "month" ? "selected" : ""}>a month</option><option value="year" ${f.per === "year" ? "selected" : ""}>a year</option></select></label>
      <label>Renews <input type="date" data-form="renewal" value="${esc(f.renewal)}" aria-label="Renewal date"></label>
      <div class="row-actions"><button class="btn primary small" data-action="form-save">Save policy</button><button class="btn ghost small" data-action="form-cancel">Cancel</button></div>
    </div>`;
}

/* ================= SHOW CALCULATION (sheet over the phone screen) ================= */
const pct1 = n => (Math.round(n * 1000) / 10) + "%";

function calcFormula() {
  const A = S.assumptions, plan = ui.future.track === "plan";
  const hero = S.pots.goals[0];
  const cuts = sum(S.levers.filter(l => l.cut && actions.levers[l.id]).map(l => l.monthly));
  const baseSpend = S.avg.spend - S.cancelledSaving - (plan ? cuts : 0);
  const loanLine = S.pots.loans.map(l => `${money(l.repayment)} a month comes out and interest is ${pct1(l.rate)} a year on what is left`).join("; ");
  return `
    <ol class="formula">
      <li><b>Pay</b> starts at ${money(CUSTOMER.payNet)} a fortnight (${money(CUSTOMER.payNet * 26 / 12)} a month) and rises ${pct1(A.salaryGrowth)} once a year.</li>
      <li><b>Spending</b> starts at ${money(baseSpend)} a month${plan && cuts > 0 ? ` (your 3-month average less the plan's cuts of ${money(cuts)})` : " (your 3-month average)"} and rises with inflation, ${pct1(A.inflation)} a year, every month.</li>
      <li><b>Random expenses</b>: ${pct1(A.buffer)} of that month's spending is set aside.</li>
      <li><b>Loan</b>: ${loanLine || "none"}.</li>
      <li><b>Goals</b>: ${plan
        ? `${money(S.plan.withPlan.monthly)} a month goes to the ${esc(hero.name)}. When a goal is done the money rolls on to the next goal, then the emergency fund, then extra loan repayments, then a Future fund.`
        : `the ${money(S.plan.current.monthly)} a month you save now goes to the ${esc(hero.name)}, plus any auto-save you have set up. Nothing rolls on when a goal is done.`}</li>
      <li><b>Interest</b>: every savings pot earns ${pct1(CUSTOMER.savingsRate)} a year.</li>
      <li><b>Spare cash</b> is not counted as savings. It stays in everyday spending. If a month comes up short, transfers shrink first, then the everyday balance, then the emergency fund.</li>
      <li><b>Mood</b> is one score: ${pct(MOOD_WEIGHTS.goals)} goals against their dates, ${pct(MOOD_WEIGHTS.ef)} emergency fund, ${pct(MOOD_WEIGHTS.loan)} loan repaid, ${pct(MOOD_WEIGHTS.cash)} everyday cushion.</li>
    </ol>`;
}

function calcTable() {
  const s = FV.snap, md = FV.mood;
  const flows = [["Pay in", s.income], ["Spending", -s.spend], ["Random-expense buffer", -s.buffer], ["Loan repayments", -s.loanPaid], ["Into goals and savings", -s.transfers], ["Spare cash (spent, not saved)", s.spare]];
  if (s.shortfall > 0.5) flows.push(["Short this month", -s.shortfall]);
  const stand = [["Everyday account", money(s.cash)]]
    .concat(s.goals.map(g => [g.name, g.done ? `Done ${monthYear(dateFromMonths(g.doneAt))}` : `${money(g.saved)} of ${money(g.target)}`]))
    .concat([["Emergency fund", `${money(s.ef.saved)} of ${money(s.ef.target)}`]])
    .concat(s.loans.map(l => [`${l.name} left`, l.balance > 0.5 ? money(l.balance) : `Paid off ${monthYear(addMonths(APP.today, l.paidOffAt))}`]))
    .concat(s.future > 0.5 ? [["Future fund", money(s.future)]] : [])
    .concat(s.card > 0.5 ? [["Credit card debt", money(s.card)]] : [])
    .concat([["Total savings (the vault)", money(s.savings)], ["Mood", `${md.label} · ${Math.round(md.score * 100)} of 100`]]);
  return `
    <table class="calc">
      <thead><tr><th>A month at this point</th><th>${ui.future.years === 0 ? "Now" : "Year " + ui.future.years}</th></tr></thead>
      <tbody>${flows.map(([k, v]) => `<tr><td>${k}</td><td class="${v < 0 ? "" : "pos"}">${money(v)}</td></tr>`).join("")}</tbody>
    </table>
    <table class="calc">
      <thead><tr><th>Where things stand</th><th>${ui.future.years === 0 ? "Today" : monthYear(s.date)}</th></tr></thead>
      <tbody>${stand.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</tbody>
    </table>
    <small class="fine">Mood parts: goals ${pct(md.parts.goals)}, emergency fund ${pct(md.parts.ef)}, loan ${pct(md.parts.loan)}, cushion ${pct(md.parts.cash)}.</small>`;
}

function calcYears() {
  return `
    <div class="chips wrap">${[0, 1, 2, 3, 4, 5].map(y => `<button class="chip ${ui.future.years === y ? "on" : ""}" data-action="future-years" data-years="${y}">${y === 0 ? "Today" : y + (y === 1 ? " year" : " years")}</button>`).join("")}</div>
    <div class="seg" role="group" aria-label="Which track">
      <button data-action="future-track" data-track="same" class="${ui.future.track === "same" ? "on" : ""}">Same track</button>
      <button data-action="future-track" data-track="plan" class="${ui.future.track === "plan" ? "on" : ""}">With my plan</button>
    </div>`;
}

function renderSheet() {
  const el = $("#sheet");
  if (!ui.calcOpen) { el.classList.remove("open"); el.innerHTML = ""; return; }
  if (el.classList.contains("open")) { updateCalc(); return; } // keep the inputs (and focus) in place
  const A = ui.assumptions;
  const field = (key, label, unit) => `<label>${label}<span><input type="number" data-assume="${key}" min="0" max="25" step="0.5" value="${+(A[key] * 100).toFixed(1)}" aria-label="${label}"> ${unit}</span></label>`;
  el.innerHTML = `
    <div class="sheet-card" role="dialog" aria-label="How this is calculated">
      <div class="card-head"><b>How this is calculated</b><button class="x" data-action="calc-close" aria-label="Close">✕</button></div>
      <div id="calc-years">${calcYears()}</div>
      <h4>Assumptions (edit to see everything update)</h4>
      <div class="assume">
        ${field("inflation", "Inflation", "% a year")}
        ${field("salaryGrowth", "Salary growth", "% a year")}
        ${field("buffer", "Random-expense buffer", "% of spending")}
        <button class="btn small ghost" data-action="calc-reset">Reset to defaults</button>
      </div>
      <h4>The formula in plain words</h4>
      <div id="calc-formula">${calcFormula()}</div>
      <h4>Key numbers</h4>
      <div id="calc-table">${calcTable()}</div>
      <p class="fine">Estimates, not promises. General information, not financial advice.</p>
    </div>`;
  el.classList.add("open");
}
function updateCalc() {
  const y = $("#calc-years"), f = $("#calc-formula"), t = $("#calc-table");
  if (y) y.innerHTML = calcYears();
  if (f) f.innerHTML = calcFormula();
  if (t) t.innerHTML = calcTable();
}

/* ================= HARDSHIP (calm mode) ================= */
function hardshipCard() {
  const h = S.hardship;
  const done = ui.hardshipDone;
  const stillShort = S.runway.min.value < 0;
  return `
    <section class="card hard" id="hardship-card">
      <div class="says-head"><span class="avatar calm">🧭</span><div><b>Heads up. Let's sort this together.</b><small>No streaks, no badges, no nudges for now. Nothing is lost.</small></div></div>
      <p>On your current path your everyday account dips to <b>${money(h.shortBy * -1)}</b> around <b>${dateShort(h.from)}</b>${h.rentDue ? ", the day rent goes out" : ""}${h.to ? `, and comes back up on ${dateShort(h.to)} when you're paid` : ""}. The cause is ${h.cause}, not your habits.</p>
      ${done.length ? `<div class="done">${h.options.filter(o => done.includes(o.id)).map(o => `<span>✅ ${esc(o.title)}</span>`).join("")}</div>` : ""}
      ${stillShort ? `<p class="small">Still short by about <b>${money(-S.runway.min.value)}</b>. Pick one or combine a couple:</p>` : `<p class="ok small"><b>Sorted.</b> Lowest point is now ${money(S.runway.min.value)} and every payment still goes out on time.</p>`}
      <div class="options">
        ${h.options.map(o => `<button class="opt" data-action="hardship" data-id="${o.id}" ${done.includes(o.id) ? "disabled" : ""}><span class="ico">${o.icon}</span><span><b>${esc(o.title)}</b><small>${esc(o.sub)}</small></span></button>`).join("")}
      </div>
      ${whyBox("hard-why", `Two things changed this month: a car repair you could not plan for and a shorter pay. Everything else is normal. I switched off the game because a badge is not helpful right now. I will switch it back on when the low point is above zero for two pay cycles.`)}
      <p class="fine">No payment is blocked. This is general information, not financial advice. Westpac Assist is a free service.</p>
    </section>`;
}

function resolvedCard() {
  const pause = pauseInfo(S.pots);
  const titles = {
    cover: actions.coverSource === "hero" ? "Moved money from Car Fund to cover rent" : `Used ${money(actions.coverFromSavings)} of the emergency fund to cover rent`,
    pause: `Car Fund transfers paused for 6 weeks, restarting ${pause.resume ? dateShort(pause.resume) : "soon"}`,
    rent: `Rent date request (the ${ordinal(RENT_MOVE_DAY)}) drafted for your agent`,
    human: "Westpac Assist will call tomorrow 10–11am",
  };
  return `
    <section class="card hard" id="hardship-card">
      <div class="says-head"><span class="avatar calm">🧭</span><div><b>Sorted for now.</b><small>Lowest point in the next 60 days is ${money(S.runway.min.value)}.</small></div></div>
      <div class="done">${ui.hardshipDone.map(id => `<span>✅ ${esc(titles[id] || id)}</span>`).join("")}</div>
      <p class="small">Every payment still goes out on time. I'll keep things calm until the low point stays above zero for two pay cycles, then streaks and offers pick up where they left off.</p>
      ${ui.hardshipDone.includes("human") ? "" : `<div class="row-actions"><button class="btn ghost" data-action="hardship-human">🧑‍💼 Still want to talk to Westpac Assist?</button></div>`}
      <p class="fine">General information, not financial advice.</p>
    </section>`;
}

/* ================= INSIGHTS ================= */
function insightsView() {
  const { avg, tx, insights } = S;
  const bm = monthlyBreakdown(tx);
  const keys = Object.keys(bm).sort().filter(k => k > "2026-05");
  const cols = keys.map(k => ({ label: monthLabel(k), value: bm[k].spend, partial: k === monthKey(APP.today) }));
  const items = CATEGORIES.map(c => ({ label: c.label, value: avg.cats[c.id], color: c.color })).sort((a, b) => b.value - a.value);
  return `
    ${subTabs([["🧭", "Overview"], ["✨", "Insights"], ["🥧", "Budget"], ["🗓️", "Bills"]])}
    <div class="sec-row"><h3 class="sec" data-action="open-main"><span class="hico" aria-hidden="true">🔮</span>Future Me <span>›</span></h3><small class="fv-when">${esc(FV.when)}</small></div>
    ${windowPanel()}
    <h3 class="sec" style="margin:14px 2px 8px"><span class="hico" aria-hidden="true">🧰</span>Money tools</h3>
    <div class="tiles tools">
      <section class="tile tool" data-action="scroll-to" data-id="by-category"><small>CASH FLOW</small><b>${money(avg.income - avg.spend)}</b><i>Monthly average</i>
        <div class="flow"><span>Expenses</span><span>${money(avg.spend)}</span></div>${progressBar(avg.spend / Math.max(avg.income, avg.spend), "#8e2de2")}
        <div class="flow"><span>Income</span><span>${money(avg.income)}</span></div>${progressBar(avg.income / Math.max(avg.income, avg.spend), "#1f1c4f")}</section>
      <section class="tile tool" data-action="scroll-to" data-id="by-category"><small>CATEGORIES</small><span>🏷️</span><i>${esc(items[0].label)}</i><b>-${money(items[0].value)}</b><i>Biggest category, a month</i></section>
      <section class="tile tool" data-action="tab" data-tab="home"><small>BILLS CALENDAR</small><span>🗓️</span><i>See the next 60 days of bills on Home</i></section>
      <section class="tile tool" data-action="tab" data-tab="goal"><small>BUDGET</small><span>🛠️</span><i>Track and plan your spending</i></section>
    </div>
    <section class="greet" id="by-category"><h2>Where your money goes</h2><p>Average of ${S.window.map(monthLabel).join(", ")} · ${money(avg.spend)} a month on ${money(avg.income)} in</p></section>
    <section class="card">
      <div class="card-head"><b>By category</b><small>a month</small></div>
      ${barChartH(items)}
      <div class="split four"><span>Essentials <b>${money(avg.essential)}</b></span><span>Flexible <b>${money(avg.discretionary)}</b></span><span>Saved <b>${money(avg.transfers)}</b></span><span>Loan <b>${money(avg.loan)}</b></span></div>
    </section>
    <section class="card">
      <div class="card-head"><b>Monthly spend</b><small>* so far</small></div>
      ${columnChart(cols)}
    </section>
    <h3 class="h3"><span class="hico" aria-hidden="true">💡</span>What I noticed</h3>
    ${insights.map(insightCard).join("")}
    <p class="fine">Categories are assigned automatically. Tap any insight for the reasoning.</p>`;
}

function insightCard(i) {
  const added = actions.levers[i.id];
  const planStep = S.levers.find(l => l.id === i.id);
  return `
    <section class="card insight ${i.kind}">
      <div class="ins-head"><span class="ico">${i.icon}</span><div><b>${esc(i.title)}</b><small>${esc(i.detail)}</small></div></div>
      ${whyBox("ins-" + i.id, i.why)}
      <div class="row-actions">
        ${(i.actions || []).map(a => `<button class="btn small" data-action="cancel" data-id="${esc(a.id)}">${esc(a.label)} · ${money2(a.saving)}/mo</button>`).join("")}
        ${planStep && i.saving > 0 ? `<button class="btn small ${added ? "done" : "primary"}" data-action="lever" data-id="${i.id}">${added ? "✓ In your plan" : "Add to plan · +" + money(i.saving) + "/mo"}</button>` : ""}
      </div>
    </section>`;
}

/* ================= GOAL ================= */
function goalProjection() {
  const { plan } = S;
  const months = ui.slider;
  const proj = S.projection(months);
  const xl = i => (months <= 12 ? (i % 3 === 0 ? MONTHS[proj.plan[i].date.getMonth()] : null) : months <= 36 ? (i % 12 === 0 ? String(proj.plan[i].date.getFullYear()) : null) : (i % 24 === 0 ? String(proj.plan[i].date.getFullYear()) : null));
  const chart = lineChart({
    id: "proj",
    series: [
      { name: "With plan", color: "#2a78d6", values: proj.plan.map(p => p.value), area: true },
      { name: "Current path", color: "#eb6834", values: proj.current.map(p => p.value) },
    ],
    refLine: { value: plan.goal.target, label: `Goal ${compact(plan.goal.target)}` },
    xLabel: xl, height: 190,
    tooltip: i => `<b>${monthYear(proj.plan[i].date)}</b><br>With plan ${money(proj.plan[i].value)}<br>Current path ${money(proj.current[i].value)}`,
  });
  return `<div class="split"><span>With plan <b>${money(proj.plan.at(-1).value)}</b></span><span>Current path <b>${money(proj.current.at(-1).value)}</b></span></div>${chart}`;
}

function goalView() {
  const { plan, balances, levers } = S;
  const tonight = 42;
  const moved = daysMovedBy(S, tonight);
  const sooner = plan.current.months - plan.withPlan.months;
  return `
    <section class="greet"><h2>${plan.goal.emoji} ${esc(plan.goal.name)}</h2><p>${esc(plan.goal.desc)}</p></section>
    <section class="card goal-top">
      <div class="goal-row">${ring(plan.progress, { label: pct(plan.progress), color: "#2a78d6" })}<div><b>${money(balances.savings)}</b><small>of ${money(plan.goal.target)}</small></div></div>
      <div class="dates">
        <div><small>Current path</small><b>${plan.current.date ? monthYear(plan.current.date) : "—"}</b><span>${monthsText(plan.current.months)} · ${money(plan.current.monthly)}/mo</span></div>
        <div class="plan"><small>With plan</small><b>${plan.withPlan.date ? monthYear(plan.withPlan.date) : "—"}</b><span>${monthsText(plan.withPlan.months)} · ${money(plan.withPlan.monthly)}/mo</span></div>
      </div>
      ${sooner > 0.5 ? `<p class="hl">Follow the plan and you'll have the car <b>${monthsText(sooner)} sooner</b>${plan.bonus ? " (bonus interest included ✨)" : ""}.</p>` : ""}
      ${whyBox("goal-why", `Months to goal = how long until ${money(balances.savings)} growing at ${pct(CUSTOMER.savingsRate)} p.a. plus ${money(plan.withPlan.monthly)} a month reaches ${money(plan.goal.target)}. Each plan step adds its monthly amount; the bonus interest offer adds 0.5% for six months. Turn a step off and the date moves back. Nothing here is locked in.`)}
    </section>
    <section class="card">
      <div class="card-head"><b>Time slider</b><small class="proj-when">${monthsText(ui.slider)} ahead</small></div>
      <input type="range" min="3" max="120" step="1" value="${ui.slider}" data-action="slider" aria-label="Months ahead">
      <div data-fv="goal-proj">${goalProjection()}</div>
    </section>
    <section class="card">
      <div class="card-head"><b>Plan steps</b><small>+${money(plan.leverTotal)}/mo</small></div>
      ${levers.map(l => `
        <label class="lever ${actions.levers[l.id] ? "on" : ""}">
          <input type="checkbox" data-action="lever" data-id="${l.id}" ${actions.levers[l.id] ? "checked" : ""} ${S.hardship && l.id === "commit" ? "disabled" : ""}>
          <span class="ico">${l.icon}</span>
          <span class="txt"><b>${esc(l.label)}</b><small>${esc(l.sub)}</small></span>
          <span class="amt">+${money(l.monthly)}</span>
        </label>`).join("")}
    </section>
    ${S.calm ? "" : `
    <section class="card tonight">
      <div class="card-head"><b>This weekend</b><small>Saturday night</small></div>
      <p>Saturday delivery usually costs about <b>${money(tonight)}</b>. Send it to Future Me instead and the car gets <b>${moved} day${moved === 1 ? "" : "s"}</b> closer.</p>
      <div class="row-actions"><button class="btn primary" data-action="sendFuture" data-amt="${tonight}">📨 Send ${money(tonight)} to Future Me</button><button class="btn ghost" data-action="noop">Maybe later</button></div>
      <small class="fine">It is your money either way. This just shows what one night costs the goal.</small>
    </section>`}`;
}

/* ================= REWARDS ================= */
function rewardsView() {
  const { game } = S; const hardship = S.calm;
  return `
    <section class="greet"><h2>Rewards</h2><p>${hardship ? "Paused while things are tight. Nothing is lost." : "Real perks for real habits"}</p></section>
    ${hardship ? `<section class="card hard"><p>🧭 Streaks and offers are frozen, not reset. They pick up where they left off once the low point is back above zero.</p></section>` : ""}
    <section class="card level ${hardship ? "dim" : ""}">
      <div class="card-head"><b>Level ${game.level} · ${esc(game.levelName)}</b><small>${game.xp} / ${game.nextXp} XP</small></div>
      ${progressBar(game.xp / game.nextXp, "#6250d6")}
      <div class="chips">${game.streaks.map(s => `<span class="chip ${s.frozen ? "frozen" : ""}">${s.icon} ${s.count} ${s.unit} · ${esc(s.name)}${s.frozen ? " ❄️" : ""}</span>`).join("")}</div>
    </section>
    <h3 class="h3"><span class="hico" aria-hidden="true">🎁</span>Offers to unlock</h3>
    ${game.offers.map(o => `
      <section class="card offer ${o.unlocked ? "unlocked" : ""} ${hardship ? "dim" : ""}">
        <div class="ins-head"><span class="ico">${o.icon}</span><div><b>${esc(o.title)}</b><small>${esc(o.req)}</small></div>${o.unlocked ? `<span class="pill">Unlocked</span>` : ""}</div>
        ${progressBar(o.progress / o.target, o.unlocked ? "#008300" : "#2a78d6")}
        <div class="split"><span>${o.unit === "$" ? money(o.progress) + " of " + money(o.target) : `${o.progress} of ${o.target} ${o.unit}`}</span><span>${esc(o.value)}</span></div>
        ${o.cta ? `<div class="row-actions"><button class="btn primary" data-action="${o.cta.id}">${esc(o.cta.label)}</button></div>` : ""}
        ${!o.unlocked && o.target - o.progress === 1 ? `<p class="hl">One more and it's yours.</p>` : ""}
      </section>`).join("")}
    <h3 class="h3"><span class="hico" aria-hidden="true">🏅</span>Badges</h3>
    <section class="card badges ${hardship ? "dim" : ""}">
      ${game.badges.map(b => `<div class="badge ${b.earned ? "earned" : ""}"><span>${b.icon}</span><b>${esc(b.name)}</b><small>${b.earned ? "Earned" : esc(b.hint)}</small></div>`).join("")}
    </section>
    ${whyBox("rew-why", `Every reward here is something a bank can actually fund: bonus interest, a fee waiver, a rate review. They reward behaviour that is good for you anyway, so there is no reason to chase a badge you would regret.`)}
    <p class="fine">Offers are illustrative for this prototype.</p>`;
}

/* ================= CHAT ================= */
const CHIPS = ["When can I get the car?", "What's costing me the most?", "Will I be short before payday?", "Where will I be in 5 years?", "Someone needs me to pay $800 urgently"];

function chatView() {
  if (!ui.chat.length) ui.chat.push({ role: "ai", text: `Hi ${CUSTOMER.first}. Ask me anything about your spending, the Car Fund, or what's coming up. ${ui.live ? "Live AI is on." : "I'm in offline mode today, so I'll answer from your numbers directly."}` });
  return `
    <section class="greet"><h2>Ask Future Me</h2><p>${ui.live ? "Live AI (Claude) · " : "Offline scripted · "}general information, not advice</p></section>
    <div class="chatlog" id="chatlog">
      ${ui.chat.map(m => `<div class="msg ${m.role}">${m.role === "ai" ? '<span class="avatar">🔮</span>' : ""}<div>${esc(m.text).replace(/\n/g, "<br>")}</div></div>`).join("")}
      ${ui.typing ? `<div class="msg ai"><span class="avatar">🔮</span><div class="typing"><i></i><i></i><i></i></div></div>` : ""}
    </div>
    <div class="chips wrap">${CHIPS.map(c => `<button class="chip" data-action="chip" data-q="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    <form class="chatform" data-action="chat"><input id="chatin" placeholder="Type a question…" autocomplete="off"><button class="btn primary" type="submit">Send</button></form>`;
}

// Mood and key facts at 5 years on one track, without touching the slider.
function fiveYear(track) {
  const st = buildState({ scenario: ui.scenario, actions, customTx: ui.customTx, calm: S.calm, assumptions: ui.assumptions, track });
  return futureView(st, 5);
}

function scriptedReply(q) {
  const { plan, insights, runway, hardship, game, avg, balances, pots } = S;
  const t = q.toLowerCase();
  const by = id => insights.find(i => i.id === id);
  if (/scam|urgent|pay .*(now|today)|\$\d+ urgently|someone needs/.test(t)) {
    const amt = (t.match(/\$?(\d{2,5})/) || [])[1] || 800;
    return `Pause for a second. Urgency is the number one sign of a scam. Westpac will never ask you to move money to a "safe account", and a real bill can wait an hour.\n\nFor what it's worth, ${money(+amt)} out today would move the car ${Math.round(daysMovedBy(S, +amt) * 1.0)} days later and leave your everyday balance at ${money(balances.everyday - amt)}.\n\nIf it's a payment you still want to make, SaferPay will check the account name first and nothing here will block it. If you're unsure, call us on the number on the back of your card, not a number they gave you.`;
  }
  if (hardship && /(short|rent|afford|tight|payday|cover|help)/.test(t)) {
    const o = hardship.options[0];
    return `Yes, there's a gap. On the current path you'd dip to ${money(-hardship.shortBy)} on ${dateShort(hardship.from)}${hardship.to ? `, and come back on ${dateShort(hardship.to)} with your pay` : ""}. The cause is ${hardship.cause}.\n\nThe quickest fix: ${o.title.charAt(0).toLowerCase() + o.title.slice(1)}. ${o.sub} Pausing transfers helps too. Or talk to Westpac Assist, who can set up a payment arrangement without fees. All four options are on your Home screen.`;
  }
  if (/(5|five|ten|10) years|future|same track|where will i be/.test(t)) {
    const a = fiveYear("same"), b = fiveYear("plan");
    return `${a.mood.sentence}\n\n${b.mood.sentence}\n\nThe difference is the plan steps you switch on in Goal, and letting finished goals roll on to the next one. Drag the slider on Home to watch it year by year.`;
  }
  if (/(short|before payday|run out|tight|next 60|runway)/.test(t)) {
    return `No. Looking 60 days ahead, the lowest your everyday account gets is ${money(runway.min.value)} on ${dateShort(runway.min.date)}, just after rent. Pay lands ${dateShort(runway.events.find(e => e.name === "Pay").date)}. I'll flag it the moment that low point heads towards zero.`;
  }
  if (/(emergency|safety net|rainy)/.test(t)) {
    return `Your emergency fund holds ${money(pots.ef.saved)} of a ${money(pots.ef.target)} target, which is ${pots.ef.months} months of rent, groceries, transport, bills and loan repayments. That covers about ${pots.ef.monthsCovered.toFixed(1)} months today. With your plan, money rolls into it as soon as your goals are done.`;
  }
  if (/(loan|debt|owe)/.test(t)) {
    const l = pots.loans[0];
    if (!l) return "You have no loans on record.";
    const same = finishDates(S, "same").loans[l.id], withPlan = finishDates(S, "plan").loans[l.id];
    return `Your ${l.name.toLowerCase()} has ${money(l.balance)} left at ${pct1(l.rate)} a year, with ${money(l.repayment)} going out each month. On the same track it is paid off in ${same ? monthYear(same) : "more than 10 years"}. With your plan, spare money rolls into extra repayments once your goals and emergency fund are done, which brings that to ${withPlan ? monthYear(withPlan) : "more than 10 years"}.`;
  }
  if (/(japan|trip|holiday|vacation|travel)/.test(t)) {
    const g = pots.goals.find(x => x.type === "vacation");
    if (g) {
      const same = finishDates(S, "same").goals[g.id], withPlan = finishDates(S, "plan").goals[g.id];
      return [
        `The ${g.name} has ${money(g.saved)} of ${money(g.target)} (${pct(g.saved / g.target)}) and you want it by ${monthYear(g.due)}.`,
        g.auto ? `Your auto-save is ${autoLabel(g.auto)}.` : "It has no auto-save yet, so on the same track it does not move.",
        same ? `Same track: ${monthYear(same)}.` : "",
        `With your plan: ${withPlan ? monthYear(withPlan) : "not within 10 years"}.`,
        "You can set up an auto-save from the main panel on Home.",
      ].filter(Boolean).join(" ");
    }
  }
  if (/(car|goal|when|gt ?40|ford|how long)/.test(t)) {
    return `On your current path (${money(plan.current.monthly)} a month) the Car Fund reaches ${money(plan.goal.target)} in ${monthsText(plan.current.months)}. With the steps you've switched on it's ${monthsText(plan.withPlan.months)}, around ${plan.withPlan.date ? monthYear(plan.withPlan.date) : "—"}${plan.fullPlan.months < plan.withPlan.months - 0.5 ? `. Switch on every step and it's ${monthsText(plan.fullPlan.months)}` : ""}.\n\nThe biggest single lever is weekend delivery: halving it is worth ${money(by("delivery").saving)} a month. The subscriptions are the easiest: ${money(by("subs").saving)} a month without changing anything you actually use.`;
  }
  if (/(cost|most|biggest|where|spend|going)/.test(t)) {
    const top = CATEGORIES.map(c => ({ c, v: avg.cats[c.id] })).sort((a, b) => b.v - a.v);
    return `After rent, your biggest flexible spend is ${top.find(x => !x.c.essential).c.label.toLowerCase()} at ${money(top.find(x => !x.c.essential).v)} a month. Food delivery alone is ${money(by("delivery").amountMonthly)}, mostly Friday and Saturday nights, and coffee is ${money(by("coffee").amountMonthly)}.\n\nSubscriptions are ${money(by("subs").amountMonthly)} a month and three of them overlap or came from a free trial. Tap Insights to see each one with the reasoning.`;
  }
  if (/(subscri|cancel|netflix|spotify|gym)/.test(t)) return `${by("subs").title}. ${by("subs").detail}\n\n${by("subs").why}`;
  if (/(coffee|elk)/.test(t)) return `${by("coffee").title}. ${by("coffee").detail} ${by("coffee").why}`;
  if (/(delivery|uber|doordash)/.test(t)) return `${by("delivery").title}. ${by("delivery").detail} ${by("delivery").why}`;
  if (/(reward|offer|bonus|badge|unlock|streak)/.test(t)) {
    const o = game.offers[0];
    return `You're ${o.target - o.progress} ${o.unit.replace("repayments", "on-time repayment")} away from ${o.title.toLowerCase()}, ${o.value.toLowerCase()}. Your card balance of ${money(CUSTOMER.card.owing)} is due ${dateShort(CUSTOMER.card.due)}; paying it from Rewards unlocks it today. The fee waiver needs one more payday transfer.`;
  }
  if (/(how|why|work|know|trust|accurate|predict)/.test(t)) {
    return `I look at your last three full months of transactions, sort each one into a category, and spot anything that repeats: a merchant on the same day of the week, a charge on the same day each month, a spike after payday.\n\nFor the future slider I run the months one at a time: pay rises once a year, spending rises with inflation, a buffer covers random expenses, the loan shrinks and savings earn ${pct(CUSTOMER.savingsRate)} p.a. Tap Show calculation to see and change every assumption. It's general information, not financial advice, and nothing here ever blocks a payment.`;
  }
  if (/(privacy|data|safe|opt|share)/.test(t)) return `This is opt-in and you can switch it off any time. I only read the transactions you already see in the app, I don't share them, and I never move money without you tapping a button. Nudges are suggestions, not rules.`;
  if (/(hi|hello|hey|thanks)/.test(t)) return `Hey! Try one of the questions below, or ask about the car, the plan, or what's coming up.`;
  return `I can help with your spending, the Car Fund plan, rewards, or what the next 60 days look like. Try "When can I get the car?" or "Will I be short before payday?"`;
}

async function sendChat(q) {
  q = (q || "").trim(); if (!q) return;
  ui.chat.push({ role: "me", text: q }); ui.typing = true; render(); scrollChat();
  let reply = null;
  if (ui.live) {
    try {
      const r = await fetch("http://localhost:8787/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: ui.chat.filter(m => m.role !== "sys").map(m => ({ role: m.role === "me" ? "user" : "assistant", content: m.text })), context: aiContext(S, ui.future.years) }) });
      if (r.ok) reply = (await r.json()).reply;
    } catch (e) { reply = null; }
  }
  await new Promise(res => setTimeout(res, ui.live ? 0 : 700 + Math.random() * 500));
  ui.chat.push({ role: "ai", text: reply || scriptedReply(q) }); ui.typing = false; render(); scrollChat();
}
function scrollChat() { const l = $("#chatlog"); if (l) l.scrollTop = l.scrollHeight; const v = view(); v.scrollTop = v.scrollHeight; }

async function checkLive() {
  try {
    const c = new AbortController(); setTimeout(() => c.abort(), 1200);
    const r = await fetch("http://localhost:8787/health", { signal: c.signal });
    ui.live = r.ok;
  } catch { ui.live = false; }
  $("#ai-status").textContent = ui.live ? "Live AI: connected (localhost:8787)" : "Live AI: off · scripted answers";
  $("#ai-status").classList.toggle("on", ui.live);
}

/* ================= actions ================= */
const VIEWS = { home: homeView, main: mainView, accounts: accountsView, payments: paymentsView, insights: insightsView, more: moreView, goal: goalView, rewards: rewardsView, chat: chatView };

function goToHardship() {
  ui.tab = "home"; render();
  requestAnimationFrame(() => { const c = $("#hardship-card"); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" }); });
}

function handle(action, el) {
  if (action !== "scene") clearSceneTimers(); // any manual action stops the scene 5 animation
  switch (action) {
    case "tab": ui.tab = el.dataset.tab; ui.form = null; ui.gearOpen = false; ui.bgOpen = false; render(); break;
    case "why": { const id = el.dataset.id; ui.expanded.has(id) ? ui.expanded.delete(id) : ui.expanded.add(id); render(); break; }
    case "cancel": {
      const name = el.dataset.id; const r = RECURRING.find(x => x.name === name);
      const before = S.plan.withPlan.months;
      actions.cancelled.add(name); rebuild();
      const after = S.plan.withPlan.months;
      const wk = Math.round((before - after) * 4.3);
      toast(`🕵️ ${name} cancelled · +${money2(r.amount)}/mo to Car Fund${wk > 0 ? ` · car ${wk} week${wk === 1 ? "" : "s"} closer` : ""}${actions.cancelled.size === 1 ? " · badge earned: Subscription Sleuth" : ""}`, { confetti: actions.cancelled.size === 1 });
      render(); break;
    }
    case "lever": {
      const id = el.dataset.id; const before = S.plan.withPlan.months;
      actions.levers[id] = el.type === "checkbox" ? el.checked : !actions.levers[id]; rebuild();
      const diff = Math.round((before - S.plan.withPlan.months) * 30.4);
      if (diff !== 0) toast(`${diff > 0 ? "🚗 Car date " + Math.abs(diff) + " days closer" : "Car date " + Math.abs(diff) + " days later"} · with plan: ${monthsText(S.plan.withPlan.months)}`);
      render(); break;
    }
    case "payCard": {
      actions.paidCard = true; rebuild();
      toast(`⏱️ Paid ${money(CUSTOMER.card.owing)} on time · 3 in a row · <b>+0.50% bonus interest unlocked</b> · car ${Math.round(daysMovedBy(S, 95))} days closer`, { confetti: true });
      render(); break;
    }
    case "sendFuture": {
      const amt = +el.dataset.amt; const d = daysMovedBy(S, amt);
      actions.sentToFuture += amt; rebuild();
      toast(`📨 ${money(amt)} sent to Future Me · car ${d} day${d === 1 ? "" : "s"} closer · badge earned`, { confetti: true });
      render(); break;
    }
    case "slider": {
      ui.slider = +el.value;
      const box = document.querySelector('[data-fv="goal-proj"]');
      if (box) { box.innerHTML = goalProjection(); wireCharts(box); }
      const lab = $(".proj-when"); if (lab) lab.textContent = `${monthsText(ui.slider)} ahead`;
      break;
    }
    case "hardship": {
      const id = el.dataset.id; const h = S.hardship; const o = h.options.find(x => x.id === id);
      if (id === "cover") { actions.coverFromSavings = o.amount; actions.coverSource = o.source; }
      if (id === "pause") actions.pauseTransfers = true;
      if (id === "rent") actions.rentMoved = true;
      if (id === "human") { actions.humanRequested = true; toast("🧑‍💼 Westpac Assist will call you tomorrow 10–11am · reference WA-48213"); }
      ui.hardshipDone.push(o.id);
      rebuild();
      if (id !== "human") toast(S.runway.min.value >= 0 ? `✅ Sorted · lowest point now ${money(S.runway.min.value)}` : `Lowest point now ${money(S.runway.min.value)} · still short, combine with another option`);
      render(); break;
    }
    case "hardship-human": actions.humanRequested = true; ui.hardshipDone.push("human"); toast("🧑‍💼 Westpac Assist will call you tomorrow 10–11am · reference WA-48213"); render(); break;

    /* ----- window panel, main panel, future slider ----- */
    case "open-main": ui.tab = "main"; ui.gearOpen = false; render(); break;
    case "avatar-tap": ui.moodOpen = !ui.moodOpen; refreshFuture(); if (ui.moodOpen) fetchMoodLive(); break;
    case "calm-talk": goToHardship(); break;
    case "win-gear": ui.gearOpen = !ui.gearOpen; render(); break;
    case "win-toggle": ui.windowShow[el.dataset.id] = el.checked; ui.windowShow.auto = false; render(); break;
    case "win-auto": ui.windowShow = defaultShow(); render(); break;
    case "win-avatar": ui.avatarSet = AVATAR_SET = el.dataset.id; render(); break;
    case "future-years": ui.future.years = clamp(Math.round(+(el.dataset.years ?? el.value)), 0, 5); refreshFuture({ flash: true }); break;
    case "future-track": ui.future.track = el.dataset.track === "plan" ? "plan" : "same"; rebuild(); refreshFuture({ flash: true }); break;
    case "calc-open": ui.calcOpen = true; renderSheet(); break;
    case "calc-close": ui.calcOpen = false; renderSheet(); break;
    case "calc-reset": ui.assumptions = { ...ASSUMPTIONS }; rebuild(); refreshFuture(); $("#sheet").classList.remove("open"); renderSheet(); break;
    case "form-open": {
      const kind = el.dataset.kind, id = el.dataset.id;
      if (ui.form && ui.form.kind === kind && ui.form.id === id) { ui.form = null; refreshFuture(); break; }
      if (kind === "policy") ui.form = { kind, id, ptype: "home", provider: "", premium: "", per: "month", renewal: "2027-06-30" };
      else if (kind === "goal") ui.form = { kind, id, cat: "generic", name: "", target: "", due: "2027-12-31", auto: 0 };
      else if (kind === "edit") { const G = GOALS.find(x => x.id === id); ui.form = { kind, id, cat: goalIconId(G), cat0: goalIconId(G), name: G.name, target: G.target, due: isoDate(G.due) }; }
      else {
        const pot = S.pots.goals.find(x => x.id === id);
        ui.form = kind === "auto" ? { kind, id, amount: pot.auto ? pot.auto.amount : 50, every: pot.auto ? pot.auto.every : "payday" } : { kind, id, amount: 100 };
      }
      refreshFuture(); break;
    }
    case "form-cancel": ui.form = null; refreshFuture(); break;
    case "bg-edit": ui.bgOpen = !ui.bgOpen; render(); break;
    case "bg-set": {
      const id = el.dataset.id;
      if (!unlockedBgs().includes(id)) { const q = quests().find(x => x.reward.kind === "bg" && x.reward.id === id); toast(`🔒 Finish the quest "${q ? q.title : "in your letter"}" to unlock this`); break; }
      setBackground(id); render(); toast(`Background set to ${BACKGROUNDS.find(b => b[0] === id)[1]}`); break;
    }
    case "form-icon": if (ui.form && (ui.form.kind === "goal" || ui.form.kind === "edit")) { ui.form.cat = el.dataset.id; refreshFuture(); } break;
    case "open-goal": { const id = el.dataset.id; ui.tab = "main"; ui.gearOpen = false; render(); scrollToId("goal-" + id); break; }
    case "open-loans": ui.tab = "main"; ui.gearOpen = false; render(); scrollToId("loans"); break;
    case "open-bank": ui.tab = "main"; ui.gearOpen = false; render(); scrollToId("bank"); break;
    case "jump": { // from the picture or a search result to the matching section of the Future Me page
      const id = el.dataset.id; ui.tab = "main"; ui.gearOpen = false; ui.bgOpen = false;
      if (id === "new-goal" && !(ui.form && ui.form.kind === "goal")) ui.form = { kind: "goal", id: "newgoal", cat: "generic", name: "", target: "", due: "2027-12-31", auto: 0 };
      render(); scrollToId(id); break;
    }
    case "search": {
      ui.searchOpen = !(ui.searchOpen && ui.tab === "main"); ui.search = ""; ui.tab = "main"; ui.gearOpen = false;
      render(); view().scrollTop = 0;
      if (ui.searchOpen) { const i = $("#fm-search"); if (i) i.focus({ preventScroll: true }); }
      break;
    }
    case "goal-delete": {
      const id = el.dataset.id, i = GOALS.findIndex(g => g.id === id);
      if (i < 0 || !ui.customGoals.includes(id)) break;
      const name = GOALS[i].name;
      GOALS.splice(i, 1); ui.customGoals = ui.customGoals.filter(x => x !== id); delete actions.autos[id]; delete actions.added[id];
      ui.form = null; toast(`${esc(name)} deleted`); render(); break;
    }
    case "stub": toast(NOT_IN_DEMO); break;
    case "scroll-to": scrollToId(el.dataset.id); break;
    case "new-goal": ui.tab = "main"; ui.gearOpen = false; ui.form = { kind: "goal", id: "newgoal", cat: "generic", name: "", target: "", due: "2027-12-31", auto: 0 }; render(); requestAnimationFrame(() => { const p = document.querySelector(".icon-pick"); if (p) p.scrollIntoView({ behavior: "smooth", block: "center" }); }); break;
    case "open-quests": ui.tab = "main"; ui.gearOpen = false; render(); scrollToId("quests"); break;
    case "quest-log": {
      const id = el.dataset.id, q = quests().find(x => x.id === id);
      if (!q || !q.log || q.have >= q.need) break;
      ui.quests[id]++;
      if (!checkUnlocks()) toast(`Logged · ${ui.quests[id]} of ${q.need} ${q.unit}`);
      refreshFuture(); break;
    }
    case "form-remove": {
      const f = ui.form; if (!f) break;
      actions.autos[f.id] = null; ui.form = null; toast("Auto-save removed"); render(); break;
    }
    case "form-save": saveForm(); break;

    case "chip": sendChat(el.dataset.q); break;
    case "noop": toast("No worries. I'll ask again next weekend."); break;
    case "scene": scene(el.dataset.scene); break;
    case "reset": resetDemo(); break;
  }
}

// scroll to a section and outline it briefly, so it is clear where the tap landed
function scrollToId(id) {
  requestAnimationFrame(() => {
    const c = document.getElementById(id); if (!c) return;
    c.scrollIntoView({ behavior: "smooth", block: "start" });
    c.classList.add("flash"); setTimeout(() => c.classList.remove("flash"), 1600);
  });
}

function saveForm() {
  const f = ui.form; if (!f) return;
  if (f.kind === "goal") {
    const name = f.name.trim(), target = Math.round(parseFloat(f.target)), due = new Date(f.due + "T00:00:00"), auto = Math.round(parseFloat(f.auto) || 0);
    if (!name) { toast("Give the goal a name"); return; }
    if (!(target >= 50)) { toast("Enter a target of at least $50"); return; }
    if (isNaN(due) || due <= APP.today) { toast("Pick a date in the future"); return; }
    const picture = GOAL_PICTURES.find(i => i[0] === f.cat);
    const [, label, emoji] = picture || GOAL_ICONS.find(i => i[0] === f.cat) || GOAL_ICONS.at(-1);
    const id = "g" + (ui.customGoals.length + 1) + "-" + GOALS.length;
    GOALS.push({ id, name, fund: `${name} fund`, type: picture ? f.cat : "other", cat: picture ? undefined : f.cat, emoji, target, saved: 0, due, auto: null, priority: 10 + GOALS.length, desc: label });
    ui.customGoals.push(id);
    let note = "";
    if (auto > 0) {
      actions.autos[id] = { amount: auto, every: "payday" };
      rebuild();
      if (S.hardship) { delete actions.autos[id]; note = " · auto-save left off, it would leave you short before payday"; }
    }
    ui.form = null;
    toast(`${emoji} ${esc(name)} added · it is now in your window${note}`);
    render(); scrollToId("goal-" + id); return;
  }
  if (f.kind === "edit") {
    const G = GOALS.find(x => x.id === f.id); if (!G) return;
    const name = String(f.name).trim(), target = Math.round(parseFloat(f.target)), due = new Date(f.due + "T00:00:00");
    if (!name) { toast("Give the goal a name"); return; }
    if (!(target >= 50)) { toast("Enter a target of at least $50"); return; }
    if (isNaN(due) || due <= APP.today) { toast("Pick a date in the future"); return; }
    const custom = ui.customGoals.includes(G.id);
    if (!custom && !ui.goalEdits[G.id]) ui.goalEdits[G.id] = { ...G }; // so Reset can put the demo goal back
    G.name = name; G.target = target; G.due = due;
    if (custom) G.fund = `${name} fund`;
    if (f.cat && f.cat !== f.cat0) {
      const picture = GOAL_PICTURES.find(i => i[0] === f.cat);
      const [, label, emoji] = picture || GOAL_ICONS.find(i => i[0] === f.cat) || GOAL_ICONS.at(-1);
      G.type = picture ? f.cat : "other"; G.cat = picture ? undefined : f.cat; G.emoji = emoji;
      if (custom) G.desc = label;
    }
    ui.form = null; toast(`${G.emoji} ${esc(name)} updated`); render(); scrollToId("goal-" + G.id); return;
  }
  if (f.kind === "policy") {
    const premium = parseFloat(f.premium), renewal = new Date(f.renewal + "T00:00:00");
    if (!f.provider.trim()) { toast("Add the insurer's name"); return; }
    if (!(premium > 0)) { toast("Enter the premium"); return; }
    if (isNaN(renewal)) { toast("Pick a renewal date"); return; }
    const [, icon, label] = POLICY_TYPES.find(p => p[0] === f.ptype) || POLICY_TYPES.at(-1);
    ui.policies.push({ id: "p" + (ui.policies.length + 1), type: f.ptype, icon, name: `${label} insurance`, provider: f.provider.trim(), premium, per: f.per === "year" ? "year" : "month", renewal, source: "added manually" });
    ui.form = null; toast(`📄 ${label} insurance added · renews ${dateShort(renewal)} ${renewal.getFullYear()}`); render(); return;
  }
  const g = S.pots.goals.find(x => x.id === f.id);
  const amt = Math.round(parseFloat(f.amount) * 100) / 100;
  if (!(amt > 0)) { toast("Enter an amount above $0"); return; }
  if (f.kind === "auto") {
    const had = Object.prototype.hasOwnProperty.call(actions.autos, g.id), prev = actions.autos[g.id];
    const wasShort = !!S.hardship;
    actions.autos[g.id] = { amount: amt, every: f.every === "second" ? "second" : "payday" };
    rebuild();
    if (S.hardship && !wasShort) { // the new transfer would push the 60-day low point below zero
      if (had) actions.autos[g.id] = prev; else delete actions.autos[g.id];
      rebuild(); toast("That auto-save would leave you short before payday. Try a smaller amount."); return;
    }
    ui.form = null;
    const fin = finishDates(S).goals[g.id];
    toast(`📅 Auto-save on: ${autoLabel(actions.autos[g.id])} to ${esc(g.name)}${fin ? ` · on track for ${monthYear(fin)}` : ""}`);
    render(); return;
  }
  // add money now
  const room = Math.max(0, Math.floor(S.runway.min.value));
  if (amt > room) { toast(room > 0 ? `That would leave you short before payday. You can safely move up to ${money(room)}.` : "There is no spare cash to move right now. Nothing changed."); return; }
  if (g.rank === 0) actions.sentToFuture += amt; else actions.added[g.id] = (actions.added[g.id] || 0) + amt;
  ui.form = null; rebuild();
  const pot = S.pots.goals.find(x => x.id === g.id);
  toast(`💸 ${money(amt)} moved to ${esc(g.name)} · ${pct(Math.min(1, pot.saved / pot.target))} saved`, { confetti: pot.saved >= pot.target });
  render();
}

/* ---------- demo scenes ---------- */
let sceneTimers = [];
function clearSceneTimers() { sceneTimers.forEach(clearTimeout); sceneTimers = []; }
const resetHardshipChoices = () => { ui.hardshipDone = []; actions.coverFromSavings = 0; actions.coverSource = "ef"; actions.pauseTransfers = false; actions.rentMoved = false; };

function scene(n) {
  clearSceneTimers();
  ui.scene = n; ui.expanded.clear(); ui.form = null; ui.gearOpen = false; ui.calcOpen = false;
  ui.future = { years: 0, track: "same" }; ui.moodOpen = false;
  if (n === "1") { ui.scenario = "normal"; ui.tab = "insights"; }
  if (n === "2") { ui.scenario = "normal"; ui.tab = "goal"; }
  if (n === "3") { ui.scenario = "normal"; ui.tab = "rewards"; }
  if (n === "4") { ui.scenario = "tough"; ui.tab = "home"; ui.hardshipDone = []; actions = defaultActions(); }
  if (n === "5") { playFutureScene(); return; }
  if (n !== "4" && ui.scenario === "normal") resetHardshipChoices();
  render();
}

// Scene 5 "Future you": Today → 5 years on the same track, then the same 5 years with the plan.
function playFutureScene() {
  ui.scenario = "normal"; ui.tab = "main"; resetHardshipChoices();
  ui.moodOpen = true; // show the plain-English reason under the picture while it plays
  render(); view().scrollTop = 0;
  const at = (ms, fn) => sceneTimers.push(setTimeout(fn, ms));
  for (let y = 1; y <= 5; y++) at(700 + y * 1000, () => { ui.future.years = y; refreshFuture(); });
  at(700 + 5 * 1000 + 2000, () => {
    Object.keys(actions.levers).forEach(k => (actions.levers[k] = true));
    ui.future.track = "plan"; render();
    toast(`With my plan · all ${S.levers.length} plan steps on · same five years`, { confetti: true });
  });
}

function resetDemo() {
  clearSceneTimers();
  actions = defaultActions();
  ui.customGoals.forEach(id => { const i = GOALS.findIndex(g => g.id === id); if (i >= 0) GOALS.splice(i, 1); });
  Object.entries(ui.goalEdits).forEach(([id, orig]) => { const G = GOALS.find(g => g.id === id); if (G) { Object.keys(G).forEach(k => delete G[k]); Object.assign(G, orig); } });
  ui.goalEdits = {}; ui.searchOpen = false; ui.search = "";
  ui.customGoals = []; ui.quests = { delivery: 0, coffee: 0 }; ui.questsSeen = new Set();
  Object.assign(ui, { scenario: "normal", tab: "home", chat: [], slider: 24, hardshipDone: [], customTx: null, scene: null, future: { years: 0, track: "same" }, assumptions: { ...ASSUMPTIONS }, windowShow: defaultShow(), gearOpen: false, moodOpen: false, moodLive: null, calcOpen: false, form: null, policies: [] });
  ui.expanded.clear();
  render(); toast("Demo reset");
}

document.addEventListener("click", e => {
  const el = e.target.closest("[data-action]");
  if (!el || el.tagName === "INPUT" || el.tagName === "FORM") return;
  if (el.id === "sheet") { if (e.target === el) handle("calc-close", el); return; } // tap outside the sheet closes it
  handle(el.dataset.action, el);
});
document.addEventListener("change", e => {
  const el = e.target.closest("input[data-action]");
  if (el && el.type === "checkbox") handle(el.dataset.action, el);
  const f = e.target.closest("[data-form]");
  if (f && ui.form) ui.form[f.dataset.form] = f.value;
});
document.addEventListener("input", e => {
  const range = e.target.closest("input[type=range][data-action]");
  if (range) { handle(range.dataset.action, range); return; }
  const q = e.target.closest("[data-search]");
  if (q) { ui.search = q.value; const box = $("#search-results"); if (box) box.innerHTML = searchResults(); return; }
  const f = e.target.closest("[data-form]");
  if (f && ui.form) { ui.form[f.dataset.form] = f.value; return; }
  const a = e.target.closest("input[data-assume]");
  if (a) {
    const v = parseFloat(a.value);
    if (isNaN(v)) return;
    ui.assumptions[a.dataset.assume] = clamp(v, 0, 25) / 100;
    rebuild(); refreshFuture(); // every panel and the table update live; the input keeps its focus
  }
});
document.addEventListener("submit", e => { const f = e.target.closest("form[data-action=chat]"); if (f) { e.preventDefault(); const i = $("#chatin"); sendChat(i.value); } });
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && ui.calcOpen) { handle("calc-close"); return; }
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if (["1", "2", "3", "4", "5"].includes(e.key)) scene(e.key);
  if (e.key === "0") resetDemo();
});

window.addEventListener("DOMContentLoaded", () => {
  $("#scenario").addEventListener("change", e => { clearSceneTimers(); ui.scenario = e.target.value; resetHardshipChoices(); render(); });
  $("#csv").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { const tx = parseCsvTransactions(rd.result); if (tx.length < 10) { toast("Could not read enough rows from that CSV"); return; } ui.customTx = tx; ui.tab = "insights"; render(); toast(`📄 Loaded ${tx.length} transactions from ${f.name}`); };
    rd.readAsText(f);
  });
  $("#clear-csv").addEventListener("click", () => { ui.customTx = null; render(); toast("Back to the demo customer"); });
  checkLive();
  loadBackground();
  render();
});
