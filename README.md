# Future Me - AI money companion (Westpac AI & Banking hackathon prototype)

A gamified AI companion inside the banking app. It reads a customer's spending, predicts where their
money is heading, turns that into a goal plan they can actually follow, rewards the habits that get them
there, and switches to a calm, human-first mode when a tough month is coming.

The demo customer is fictional: first name **Abhi**, second name **S**, 27, living in **Surfers Paradise**.

Everything runs **offline from this folder**. No build step, no frameworks, no network needed. All artwork is inline SVG.

## Run it (demo laptop)

Option A, zero setup: open `app/index.html` in Chrome or Edge.

Option B, local server (recommended if the browser blocks anything on `file://`):

```bash
python -m http.server 8080 --directory app
```

Then open http://localhost:8080.

Keyboard shortcuts for the presenter panel on the left: `1` `2` `3` `4` `5` jump to the demo scenes, `0` resets.

## The five demo scenes

| Key | Scene | Screen | What to show |
|---|---|---|---|
| 1 | Spending insight | Insights | Category bars, monthly trend, "What I noticed": overlapping subscriptions, Friday/Saturday delivery habit, coffee, payday spike. Tap **Why?** on any card. Tap **Cancel Apple Music** (badge + car date moves). |
| 2 | Set the car goal | Goal | Current path vs with plan. Switch plan steps on one by one and watch the date move. Drag the time slider out to 10 years. **Send $42 to Future Me** shows what one night costs the goal. |
| 3 | Unlock an offer | Rewards | "One more on-time repayment" → **Pay $640 card balance now** → bonus interest unlocked, confetti, car date moves. Badges and streaks. |
| 4 | A tough month | Home | Car repair + reduced pay. The app drops the game tone, the window avatar turns concerned and supportive with a "Want to talk to someone?" bubble, and four options appear including a human at Westpac Assist. Pick **Use $1,150 from your emergency fund** → sorted, calm mode stays on. |
| 5 | Future you | Home | Plays by itself. The future slider runs from Today to 5 years on **Same track** and the avatar goes worried. Then it switches to **With my plan** for the same five years and the avatar ends thriving: car and trip in full colour, full shield, treasure chest, loan weight gone. |

Scene 5 switches all five plan steps on when it flips to "With my plan". Press `0` afterwards if you want a clean slate.

The **Ask** tab works in both modes: scripted answers offline, live Claude answers if the optional server is running.

## Pages and buttons

**Home (🏠)**
- Greeting "Hi Abhi" with today's date.
- **Your window**: a picture of the whole account with no numbers.
  - Avatar in the centre with five moods: thriving, happy, okay, worried, stressed. Tap it for one plain-English sentence explaining the mood (scripted offline, live Claude if the server is up).
  - Background scene is the hero goal. The Ford GT 40 is drawn in colour up to the percent saved and greyscale beyond it. Other goals (the Japan trip) appear as postcards that fill the same way.
  - Emergency fund: a full shield when funded, a part-filled shield when part funded, a warning triangle below 25%.
  - Vault: coins, notes, gold bars, then a treasure chest with diamonds, by total savings.
  - Loan: a weight chained to the vault that shrinks as the loan is repaid and disappears when it is paid off.
  - **⚙** opens "Customise what's shown" (toggle each element) with an **Automatic** button (the default).
  - Tap the picture (anywhere except the avatar) to open the main panel.
  - **Future slider**: Today, 1, 2, 3, 4, 5 years, with a **Same track / With my plan** toggle and **Show calculation**.
- Two balance cards (Everyday, and the hero goal's fund).
- **Future Me says** card with **Why?**, **See the plan** and **What changed**.
- **Next 60 days** chart with a hover tooltip and a **Why?** toggle.
- **Streaks** chips and the **Letter from future you** card. Both are hidden in calm mode.

**Main panel (opened from the window, ‹ Home goes back)**
- The same avatar and mood, with the sentence shown, and the same future slider.
- **Bank balance**: Everyday plus every savings pot.
- **Goals**, one after another: progress bar, "Wanted by" date, the date it is on track for, and two actions.
  - **Set up auto-save**: an amount and which payday (every payday or every second payday).
  - **Add money now**: a manual transfer from Everyday. It is refused if it would leave the account short before payday.
  - Both update every projection immediately.
- **Loan repayments**: balance, monthly repayment, rate and payoff date.
- **Insurances and emergency fund**: the emergency fund with its shield state, each policy with its renewal date and source (Westpac or added manually), and **＋ Add a policy** for policies held outside Westpac.

**Show calculation (sheet over the screen)**
- Year chips and the track toggle.
- Editable assumptions: inflation, salary growth, random-expense buffer. Every panel updates as you type. **Reset to defaults** restores 3%, 3%, 5%.
- The formula in plain words, and a table of the key numbers at the chosen year.

**Insights (🔍)**
- **By category** bars with totals for Essentials, Flexible, Saved and Loan.
- **Monthly spend** columns. The current month is faded and marked with an asterisk.
- **What I noticed** cards, each with **Why?**. Subscription cards have **Cancel …** buttons; habit cards have **Add to plan**.

**Goal (🚗)**
- Progress ring, current balance, and the date on the current path versus the plan.
- **Time slider** from 3 to 120 months with a projection chart.
- **Plan steps** checkboxes: automatic $150 payday transfer, drop overlapping subscriptions, delivery nights down to one a week, home coffee, round-ups.
- **This weekend** card with **Send $42 to Future Me**. Hidden in calm mode.

**Rewards (🏆)**
- Level and XP bar, streak chips, three offers with progress bars, six badges.
- **Pay $640 card balance now** unlocks the bonus-interest offer.

**Ask (💬)**
- Chat log, suggested-question chips, text box. New scripted answers cover the 5-year view, the emergency fund, the loan and the Japan trip.

**Calm mode**
- Appears when the 60-day forecast goes below zero in the tough month.
- The window avatar looks concerned and supportive (never "Stressed" or "Worried" in words) and shows a **Want to talk to someone?** bubble that leads to the options:
  - **Use $1,150 from your emergency fund** covers the gap with a small buffer.
  - **Pause Car Fund transfers for 6 weeks** skips three paydays, then transfers restart on 31 Dec.
  - **Ask to move rent to the 3rd** moves rent to 3 Dec (and the 3rd of each month after), the day pay lands.
  - **Talk to Westpac Assist** shows a toast with a reference number.

**Presenter panel (left side)**
- **1** to **5** jump to scenes. **Normal month / Tough month** dropdown. **Reset** (key 0). **Load CSV (bonus)** and **Demo data**. Live AI status line.

## Folder layout

```
app/            the prototype (open index.html)
  js/data.js    the customer, goals, emergency fund, loan, insurances, assumptions, mock transactions, CSV import
  js/engine.js  all the maths: insights, goal dates, 60-day runway, hardship radar, gamification, future simulation, mood
  js/charts.js  tiny inline-SVG charts (bars, columns, lines with tooltips, progress ring)
  js/art.js     inline-SVG artwork for the window: avatar, goal scenes, shield, vault, loan weight
  js/app.js     every screen and interaction, scripted chat, demo scenes
  css/styles.css
server/         optional live AI chat (Claude API). Keeps the key off the browser.
data/           sample-transactions.csv for the "Load CSV" bonus
docs/           IDEA_SUMMARY.md (submission text) and DEMO_SCRIPT.md (video script)
```

## Optional: live AI chat

The app checks `http://localhost:8787/health` on load. If the server is up, the Ask tab and the avatar's mood sentence use
Claude with the customer's numbers as context. If anything fails, it silently falls back to the scripted text, so the demo never breaks.

```bash
cd server
npm install
set ANTHROPIC_API_KEY=sk-ant-...      # PowerShell: $env:ANTHROPIC_API_KEY="sk-ant-..."
node server.mjs
```

The server uses `claude-opus-5-5` with server-side refusal fallbacks enabled and a system prompt that enforces
the positioning rules (general information not advice, never blocks payments, scam-aware, calm in hardship).

## Load your own CSV (bonus)

Presenter panel → **Load CSV**. Format: `date,description,amount[,category]`, negative amounts are spends.
Categories are auto-assigned from the description if the column is missing. `data/sample-transactions.csv` is an example.
Balances, goals, the loan and the emergency fund stay at the demo customer's values; the insights, projections and plan recompute from the file.

## How the maths works (so you can defend it to judges)

**Today**

- **Analysis window**: the last three complete months (Aug–Oct 2026). Averages per category drive everything. Loan repayments and transfers to savings are tracked separately from spending.
- **Insights**: recurring charges grouped by purpose (two music apps = overlap), trial conversions, merchant-by-weekday habits, spend in the 3 days after payday vs the other 11.
- **Goal date (Goal tab)**: months until `savings × (1 + r/12)^n + monthly × ((1 + r/12)^n − 1)/(r/12)` reaches the target, with r = 4.5% p.a. plus 0.5% for six months when the bonus-interest offer is unlocked. Each plan step adds its monthly amount.
- **60-day runway**: today's balance, pay every second Thursday, rent, bills, subscriptions and the loan repayment on their usual days, everyday spending spread evenly per day. The minimum is the number that triggers the hardship radar.
- **Emergency fund target**: 3 × (essential categories + loan repayments) per month. Today that is 3 × $2,889 = $8,668, and the fund holds $3,450 (40%).
- **Rewards**: all fundable by a bank (bonus interest, fee waiver, rate review) and tied to behaviour that is good for the customer anyway.

**The future slider: a month-by-month simulation**

The slider does not use a formula. It runs 120 months one at a time (the slider shows the first 60) for each track:

1. **Pay** starts at $2,120 a fortnight × 26 ÷ 12 = $4,593 a month and rises by the salary growth rate once a year.
2. **Spending** starts at the 3-month average ($3,712) and rises with inflation every month. On "With my plan" the plan's spending cuts come off first.
3. **Random expenses**: a buffer (5% of that month's spending) is deducted.
4. **Loan**: a month of interest at 9.9% p.a. is added, then the fixed $166 repayment comes off.
5. **Transfers** go to goals, then every savings pot earns 4.5% p.a.
6. **Spare cash is not counted as savings.** It stays in everyday spending, so the everyday balance holds steady rather than piling up. If a month comes up short, transfers shrink first, then the everyday balance, then the emergency fund, and only then does anything land on a credit card.

The two tracks differ in step 5:

- **Same track**: the customer keeps saving what they save today (about $200 a month to the Ford GT 40, plus any auto-save they have set up). When a goal is finished, nothing rolls on.
- **With my plan**: the plan steps that are switched on feed the hero goal. When a goal is finished, its money rolls on in a waterfall: next goal, then the emergency fund, then extra loan repayments, then a general Future fund.

With the default assumptions the simulation and the Goal tab agree on the hero goal's date (3 yr 10 mo on the current path, Mar 2028 with all five steps), because the simulation uses the same interest-then-contribution order.

Results with the defaults and all five plan steps on:

| | Same track at 5 years | With my plan at 5 years |
|---|---|---|
| Ford GT 40 | Bought Sep 2030, about 2 years 4 months late | Bought Mar 2028 |
| Japan trip | 44% saved, nearly 3 years overdue | Taken Sep 2028 |
| Emergency fund | 43% | Full |
| Loan | $1,095 still owing | Paid off Jan 2030 |
| Vault | Notes | Treasure chest (about $29,000 including an $18,800 Future fund) |
| Avatar | Worried | Thriving |

**Mood (one function: `futureMood(state, monthsAhead)`)**

One score from four parts, then cut into five moods:

- 40% **goals against their own dates**. Each unfinished goal scores its progress against where it should be by now to hit its "wanted by" date. A goal that is overdue, or was finished late, scores lower.
- 25% **emergency fund** level against its target.
- 10% **loan** share repaid.
- 25% **cash**. Today: the lowest point of the 60-day runway against a week of essentials. Later: the projected everyday balance against two weeks of essentials.

Thriving is 90 and above, happy 78, okay 62, worried 38, and stressed below that. A runway below zero or any credit card debt is always stressed. In calm mode the avatar shows a supportive face instead of the stressed or worried one.

**Vault tiers**: coins below $5,000 of savings, notes to $12,000, gold bars to $22,000, treasure chest above. Finished goals count as bought, so their money leaves the vault.

**Things to be ready to explain**

- The Insights header shows pay as the 3-month average ($4,240, two paydays a month). The simulation uses the true yearly rate ($4,593, 26 paydays a year).
- "Spare cash is spent" is a behavioural assumption, not a fact. It is stated in Show calculation, and it is why the plan moves money on payday first.
- The projection is an estimate. Change inflation to 6% in Show calculation and both tracks get visibly worse.

## Which file to edit

| What you want to change | File | Where to look |
|---|---|---|
| Product name and tagline | `app/js/data.js` | `APP` block |
| Customer name, suburb, age, pay, card | `app/js/data.js` | `CUSTOMER` block |
| Everyday balance | `app/js/data.js` | `CUSTOMER.balances.everyday` |
| Goals: name, type, target, saved, wanted-by date, auto transfer, priority | `app/js/data.js` | `GOALS` (priority 1 is the hero goal) |
| Emergency fund: months of cover and amount saved | `app/js/data.js` | `EMERGENCY_FUND` |
| Loan: balance, original amount, rate, repayment, day | `app/js/data.js` | `LOANS` |
| Insurance policies | `app/js/data.js` | `INSURANCES` (and the matching direct debit in `RECURRING`) |
| Default inflation, salary growth, buffer | `app/js/data.js` | `ASSUMPTIONS` |
| Spending categories and colours | `app/js/data.js` | `CATEGORIES` |
| Recurring bills and subscriptions | `app/js/data.js` | `RECURRING` (`name`, `amount`, `day`) |
| Merchant names in the mock data | `app/js/data.js` | `MERCHANTS` |
| Car repair ($1,350) and reduced pay ($1,480) | `app/js/data.js` | `generateTransactions` |
| Insight titles and "Why?" text | `app/js/engine.js` | `detectInsights` |
| Plan step labels and amounts | `app/js/engine.js` | `buildLevers` |
| Offers, badges, levels | `app/js/engine.js` | `gamify`, `BADGES` |
| Hardship options, rent-move day, pause length | `app/js/engine.js` | `hardshipCheck`, `RENT_MOVE_DAY`, `PAUSE_DAYS` |
| Simulation rules | `app/js/engine.js` | `simulate` |
| Mood weights, thresholds and sentences | `app/js/engine.js` | `MOOD_WEIGHTS`, `MOOD_CUTS`, `futureMood` |
| Vault tier thresholds | `app/js/engine.js` | `VAULT_TIERS` |
| Avatar, goal artwork, shield, vault, loan weight | `app/js/art.js` | `avatarParts`, `GOAL_ART`, `shieldParts`, `vaultParts`, `sceneSvg` |
| Window panel, main panel, calculation sheet | `app/js/app.js` | `windowPanel`, `mainView`, `mainBody`, `renderSheet` |
| Scene 5 timing | `app/js/app.js` | `playFutureScene` |
| Tonight's $42 delivery amount | `app/js/app.js` | `goalView` (`const tonight`) |
| Suggested chat questions and scripted answers | `app/js/app.js` | `CHIPS`, `scriptedReply` |
| Weekly letter text | `app/js/app.js` | `letter()` |
| Tab labels, app bar, presenter buttons, disclaimer | `app/index.html` | the `<nav>`, `<header>` and `<aside>` sections |
| Colours and layout | `app/css/styles.css` | `:root` variables (red accent, teal calm mode) |
| Chat model, system prompt, port | `server/server.mjs` | `MODEL`, `SYSTEM`, `PORT` |

## What changed in this version

- New: multiple goals, emergency fund, loan, insurances, projection assumptions, the window panel, the main panel, the future slider, Show calculation, and demo scene 5.
- The loan repayment ($166) and health insurance ($148) are now in the transaction history, so monthly leftover is lower than before (about $362 after bills and the loan).
- The hardship option now draws on the emergency fund first, because that is what it is for. It falls back to the Car Fund only if the emergency fund is too small.
- Fixed: the letter mentions the Ford GT 40; the rent line says Surfers Paradise; "move rent to the 3rd" moves the rent event to the 3rd; "pause for 6 weeks" ends after 6 weeks; the app bar shows the customer's initial.

## Positioning (say this out loud in the video)

Opt-in. General information, not financial advice. Nudges never block a payment. Fits Westpac's direction of
personalised AI agents for financial goals; what sets it apart is the gamification, the offer unlocks and the hardship safety net.
