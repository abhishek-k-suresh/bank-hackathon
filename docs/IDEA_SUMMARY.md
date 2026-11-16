# Future Me — idea summary (submission text)

**One line.** An opt-in AI companion in the Westpac app that shows customers where their money is heading, turns that into a plan they can actually follow, rewards the habits that get them there, and quietly switches to a safety net when a tough month is coming.

## What it does

1. **Spending analysis.** Sorts transactions into categories, then explains patterns in plain English: overlapping subscriptions, free trials that started charging, a Friday-night delivery habit, the spend spike in the three days after payday.
2. **Predictions.** Projects the customer's savings and everyday balance forward, from 60 days to 10 years, from their real habits. A time slider makes the future tangible.
3. **Goal plans.** "Follow this plan and you'll have the car in 1 year 4 months instead of 3 years 10 months." Each step is a small, concrete change with its monthly value; switching one on moves the date live. "Send tonight's $42 to Future Me" shows what a single choice costs the goal.
4. **Gamification that a bank can fund.** Streaks, levels and badges, plus offer unlocks tied to good behaviour: "one more on-time repayment unlocks 0.5% bonus interest", a fee waiver for four payday transfers in a row, a rate review at $7,000 saved.
5. **Explanations and chat.** Every prediction and nudge has a **Why?** that shows the reasoning in numbers. The Ask tab answers questions from the customer's own data, scripted offline or live via Claude.
6. **Early hardship radar.** When the 60-day forecast dips below zero, the game tone drops. The app explains the cause, offers practical options (cover from savings with auto pay-back, pause transfers, move the rent date) and a handoff to a person at Westpac Assist. Streaks freeze rather than reset.
7. **Scam-aware nudge.** Urgency or a "safe account" in chat triggers a plain warning and shows what the payment would cost the customer's goals. It complements SaferPay and Verify; it never blocks the payment.

## Why it's a good idea

- **Simpler.** The customer sees one number that matters (the date they get the thing they want) and the three or four choices that move it.
- **Smarter.** Predictions come from the customer's own patterns, not generic budgeting rules. The explanations are checkable.
- **Safer.** The hardship radar catches a shortfall weeks before a missed payment, when options are cheap. The scam nudge adds a pause without friction. Nothing is ever blocked.
- **More intuitive.** Progress bars, streaks and offers make saving feel like a game the customer can win, with rewards that are real money from the bank.
- **Fits Westpac's direction.** Westpac is building personalised AI agents for financial goals, with AI in the app by early FY27. Future Me is that agent with a personality, a reward loop and a conscience.
- **Feasible.** The prototype runs offline on a laptop from static files. The maths is simple and auditable. Rewards are things the bank already offers (bonus interest, fee waivers, rate reviews). It is opt-in, gives general information rather than financial advice, and needs only the transaction data the customer already sees.

## Judging criteria

| Criterion | How Future Me scores |
|---|---|
| Innovation (25%) | Goal-dated predictions plus a reward loop funded by the bank, with a built-in hardship switch. |
| Creativity (25%) | "Letter from future you", "Send to Future Me", a time slider, calm mode. |
| Feasibility (20%) | Static prototype, transparent maths, existing reward mechanisms, opt-in and non-advice by design. |
| Impact (20%) | Earlier hardship detection, fewer forgotten subscriptions, measurable savings behaviour, scam pause. |
| Technical (10%) | Working categorisation, projections, cash-runway forecast, CSV import, optional live LLM with the key kept server-side. |

## Guardrails we built in

Opt-in. General information, not financial advice. Nudges never block or delay a payment. Streaks freeze rather than punish in hardship. The live AI only ever sees a summary of the customer's numbers, and the key stays on the server.
