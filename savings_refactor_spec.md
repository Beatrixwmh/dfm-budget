# DFM Budget Calculator — Savings Refactor Spec

## Context

Savings is currently a property selectable inside the "new expense" form. This is a modeling error: a savings contribution is **money relocated between two pockets the user owns** (spendable → vaulted), not money that leaves their total wealth. Filing it as an expense tells the app the money vanished, which corrupts any net-worth logic.

This refactor: (1) pulls savings out of expenses into its own top-level entity and tab, (2) supports multiple simultaneous goals, (3) wires savings to the existing DFM engine using the *aggressive* (buffer-constrained, not sustainable-capped) query, and (4) handles savings correctly on the cash-flow graph and balance bar as a transfer, not a transaction.

**Execution order:** Stage 1 (data model) → Stage 2 (remove from expenses) → Stage 3 (savings tab + goal creation) → Stage 4 (cash-flow + balance integration) → Stage 5 (spend-from-savings).

---

## Key engine background (do not re-derive — reuse existing functions)

```
sustainable_rate = cumulative_events(730) / 730
raw_dfm          = min over t=1..730 of (effective_balance + cumulative_events(t) − buffer) / t
DFM (daily spend) = min(raw_dfm, sustainable_rate)
```

All calculations use `effective_balance` (B₀ minus overdue holds), never raw B₀.

**Critical distinction this spec relies on — two queries, one engine:**
- **DFM (daily spend number)** is the *conservative* query: `min(raw_dfm, sustainable_rate)`. The rate sustainable forever without drawing down principal.
- **Savings contribution capacity** is the *aggressive* query: constrained only by the buffer floor (`raw_dfm`-style), **NOT** capped at `sustainable_rate`. Savings is a deliberate drawdown of surplus toward the buffer — exactly what the sustainable cap prevents for daily spend but should permit for intentional allocation.

So: savings goal math uses the buffer-constrained rate (sustainable cap removed); daily DFM keeps the sustainable cap. The savings query is correctly the more aggressive of the two.

---

## Stage 1: Data Model

Create a top-level `Goal` entity (an array on AppState, parallel to expenses — NOT nested inside expenses).

```typescript
interface Goal {
  id: string;                    // crypto.randomUUID()
  name: string;
  type: 'target' | 'continuous';
  status: 'active' | 'paused';

  // contribution (normalized internally as a DAILY rate; cadence is display only)
  contributionRatePerDay: number;
  cadence: 'weekly' | 'biweekly' | 'monthly';   // display/entry lens only

  // target-type only
  targetAmount?: number;
  targetDate?: string;           // ISO date

  // running total
  accumulatedTotal: number;      // scheduled contributions logged + ad-hoc deposits
}

interface AppState {
  // ... existing fields ...
  goals: Goal[];
}
```

**Cadence is a lens, not a data difference.** Store everything as `contributionRatePerDay`. When the user enters "$200/week" store `200/7`; when they switch the display to monthly, show `contributionRatePerDay × 30.44`. Switching cadence must never break or force re-entry — it re-displays the same normalized rate. Biweekly = `×14`.

Persist `goals` to localStorage and include in JSON export/import. Existing saved data without a `goals` array must load fine (default to `[]`).

---

## Stage 2: Remove Savings From Expenses

- Remove the savings-goal option entirely from the new-expense and edit-expense forms.
- Remove `savings_goal` from the expense type enum and remove `targetAmount`/`targetDate`/`currentSaved`/`savingsMode` from the Expense type (these move to `Goal`).
- A new expense is now only `recurring | one_time | subscription`.
- This deletes code. Verify nothing else reads the removed fields.

---

## Stage 3: Savings Tab + Goal Creation

New top-level tab: **Savings** (vault metaphor — a container that fills, distinct from the budget that drains).

### "New Goal" flow — branches on type:

**Target amount path:**
1. Prompt for goal name and `targetAmount`.
2. **Auto-calculate the fastest reachable date** assuming maximum allocatable contribution (full available surplus diverted to the goal, buffer-constrained). Default this date into the `targetDate` field. (Algorithm below.)
3. User may **postpone** the date (pick later) but **cannot pick earlier** than the fastest date — they won't have the funds.
4. After they settle on a date, let them choose a contribution **cadence** (weekly/biweekly/monthly), and **dynamically show the per-payment amount** for that cadence.
   - If they accept the **fastest date**: full surplus is diverted; cadence only changes how the same total is *sliced* — the date is invariant to cadence.
   - If they **postpone** to a later date: recalculate a *lower* `contributionRatePerDay` that exactly reaches the target by the chosen date, then show that reduced amount sliced into the chosen cadence. (A later date means contributing less than full surplus; cadence still just slices the smaller amount.)

**Fastest-date algorithm (target path):**
The fastest date is the earliest date `d` by which cumulative max-allocatable contributions reach `targetAmount`, while never breaching the buffer at any intermediate point:
```
For each candidate completion day d, the max the user can divert by day d
is constrained so that at EVERY t in 1..d:
    effective_balance + cumulative_events(t) − contributions_so_far(t) − buffer ≥ 0
Find the smallest d where cumulative max-allocatable ≥ targetAmount.
```
This is the same min-over-t buffer-protection logic as `raw_dfm`, applied to "how fast can I divert money to the goal" instead of "how much can I spend daily." **Sustainable-rate cap is NOT applied here** — savings is the aggressive query. Reuse the existing forward-scan; do not write a nested projection.

**Fixed contribution path:**
1. Prompt for `contributionRatePerDay` (entered via cadence) and cadence.
2. **Validate feasibility against the buffer-constrained rate**: confirm the chosen contribution doesn't force a buffer breach at any t given existing obligations. If it does, surface an error: e.g. "Contributing $X/week would put you below your safety buffer around [date]. Max sustainable contribution is about $Y/week."
3. No target, no date — open-ended accumulation.

### Goal cards (one per goal):
- **Target type:** progress circle (accumulated / target), projected completion date, edit button, pause button, graph of total contribution over time.
- **Continuous type:** amount saved so far (odometer, no progress circle — there's no denominator), edit button, pause button, contribution-over-time graph.

### Pause (both types):
On pause, BOTH types: grey out the card, freeze `accumulatedTotal`, stop scheduled contributions. The frozen amount stays visible (the money is still there — pausing stops the *flow*, not the *stock*). A paused card reads visibly "asleep." No projection/date display while paused.

On unpause:
- **Continuous:** simply resume the previous contribution rate. Nothing to recompute (no date).
- **Target:** re-run the target-date creation flow from scratch against *current* finances — keep the previously-selected cadence, suggest the most aggressive (fastest) reachable date from today, and let the user accept or postpone exactly as at creation. The new contribution rate falls out of the chosen date.
  - Rationale: do NOT try to "extend the original date by the paused duration." While paused, the rest of the financial picture moves (obligations come due, balance and buffer-constrained max-allocatable rate change), so the old date may no longer be reachable — or may now be reachable faster. Recomputing on unpause replans against current reality, which is the only honest number, and reuses the creation UI the user already knows. Don't make the user reason about extensions.

Editing a target goal's contribution down toward zero remains an equivalent "reduce/stop" path and recomputes the date via the same flow.

### Ad-hoc deposits:
- Both goal types support a one-off "Add to savings" (e.g. tax refund, windfall) separate from the scheduled rate.
- `accumulatedTotal` = scheduled contributions logged + ad-hoc deposits.
- For **target** goals, an ad-hoc deposit must **recompute the projection** — the completion date jumps closer.

### Multiple goals:
- `goals` is an array; render one card per goal. Support several active simultaneously (e.g. emergency fund + trip + general). The total vaulted = sum of all goals' `accumulatedTotal`.

---

## Stage 4: Cash-Flow Graph + Balance Bar Integration

**Through-line: savings is money that left the spendable pool but stayed in total wealth.** Everything below follows from that.

### Cash-flow graph (money in / money out):
- Savings contributions **DO** appear as outflow (the money left the spendable pool), **BUT** rendered in a **distinct color** marking them as *transfer-to-savings*, not spending.
- Do not let savings masquerade as a regular expense on the graph, and do not hide it. Label it as a transfer-out so the user can see "this outflow went to myself, not spent."

### Balance bar:
- Savings appears as **its own segment** of the main total-balance bar (the vaulted portion), walled off from the spendable segment. The savings segment = sum of all goals' `accumulatedTotal`.
- The bar should make visible: spendable balance vs. vaulted savings vs. buffer.

### Contributions are NOT transactions:
- A scheduled contribution does **not** create a `Transaction` record. It only:
  1. increases the goal's `accumulatedTotal`,
  2. shows on the cash-flow graph as a distinct-color transfer-out,
  3. occupies its segment in the total-balance bar.
- (Rationale: a transaction is money leaving total wealth; a contribution is a transfer between owned pockets. Keeping it out of the transaction ledger keeps net-worth math honest.)

---

## Stage 5: Spend From Savings (unplanned expense)

When the user logs an **unplanned expense**, add a **"From savings" dropdown** listing their goals.

When a goal is selected:
- Default the saved amount from the chosen goal into the amount box (editable).
- On confirm, this is a **real expense** and produces **TWO effects** (both required — do not do only one):
  1. **Decrement the chosen goal's `accumulatedTotal`** by the spent amount (the money leaves the vault).
  2. **File a normal expense Transaction** against total balance (the money leaves total wealth — this IS a real transaction, unlike a contribution).
- DFM recalculates after.

(Rationale: spending from savings is the one savings operation that's genuinely a transaction, because the money now leaves total wealth — it's both a vault drawdown AND a real expense. A contribution is a transfer; a spend-from-savings is a transfer back to spendable *and then* an expense.)

---

## Testing Checklist

**Stage 1 (Data Model):**
- [ ] Existing saved data loads with no `goals` array (defaults to `[]`)
- [ ] Cadence stored as daily rate; switching weekly↔monthly↔biweekly re-displays same rate, never re-prompts
- [ ] JSON export/import includes goals

**Stage 2 (Remove from expenses):**
- [ ] Savings option gone from new/edit expense forms
- [ ] No component errors from removed expense fields

**Stage 3 (Savings tab):**
- [ ] Target goal: fastest date computed using buffer-constrained (NOT sustainable-capped) rate
- [ ] Fastest date respects buffer at every intermediate t, not just the endpoint
- [ ] Cannot pick a target date earlier than fastest
- [ ] Accepting fastest date: cadence change re-slices, date unchanged
- [ ] Postponing date: contribution recalculated DOWN to match later date
- [ ] Fixed contribution: infeasible (buffer-breaching) contribution surfaces an error with a max-sustainable suggestion
- [ ] Target card shows progress circle; continuous card shows amount only (no circle)
- [ ] Pause greys out the card and freezes accumulatedTotal for both types
- [ ] Unpausing a continuous goal resumes its previous rate
- [ ] Unpausing a target goal re-runs the date flow (keeps cadence, suggests fastest date from today), not a stale extended date
- [ ] Ad-hoc deposit on a target goal moves completion date closer
- [ ] Multiple simultaneous goals each render their own card

**Stage 4 (Cash-flow + balance):**
- [ ] Contributions show on cash-flow as distinct-color transfer-out (not same as expenses, not hidden)
- [ ] Savings is its own segment of the total-balance bar, walled off from spendable
- [ ] A scheduled contribution does NOT create a Transaction record
- [ ] Contribution affects: accumulatedTotal, cash-flow graph, balance-bar segment — and nothing else

**Stage 5 (Spend from savings):**
- [ ] "From savings" dropdown lists goals; selecting one defaults that goal's amount (editable)
- [ ] Confirming decrements the goal's accumulatedTotal AND files an expense transaction (both)
- [ ] Total balance decreases; vault decreases; DFM recalculates
- [ ] Vault never shows money that's already been spent

---

# ADDENDUM — Edge Cases (appended after initial build)

*These came up after CC built the original spec above. They're refinements/additions, not rewrites. Beatrix may refine further.*

## A1. Spending from a target goal BEFORE its target date

Treat spending from a target goal as a **negative ad-hoc deposit** — the exact mirror of an ad-hoc deposit, sign flipped. No new mechanism needed.

- Let them spend it (it's their money — do NOT forbid/lock it; an emergency fund you can't touch in an emergency is useless).
- Decrement `accumulatedTotal` by the spent amount.
- **Recompute the projected completion date** — it recedes (less saved now, more left to contribute), exactly as an ad-hoc deposit makes it advance.
- **Show the consequence at spend time** so it's informed, not silent: "This pushes your [goal] completion from [old date] to [new date]. Continue?"
- Do NOT auto-pause on spend (over-reacts — withdrawing once ≠ abandoning the goal).
- ONLY at an extreme (spending leaves the goal near-zero or pushes the date absurdly far) offer: "This leaves almost nothing toward [goal] — pause it or keep it active?" That's an offer at the extreme, not the default.

## A2. Savings, tiers, and deficit-mode auto-cutting

**Savings goals do NOT get a tier and do NOT appear in the tier-cut checklist.** Savings is a transfer, not an expense — you don't *cut* it (which implies deletion), you *pause* it (stop the flow, keep the stock, fully reversible). Forcing it into the tier-cut framework mis-models it.

Instead, in deficit mode (or whenever the user wants to spend more than DFM allows), surface **"pause savings contributions" as the FIRST and most prominent lever, ABOVE all tier cuts.** Rationale: pausing a transfer-to-yourself is the gentlest, most-reversible adjustment — it harms nothing real (saved money stays put, goal just sleeps) and resumes easily. Cutting a real expense (gym, streaming) is a bigger loss than pausing a contribution you'll resume.

Deficit/overspend resolution hierarchy becomes:
1. "You have $X of surplus above buffer you could dip into" (the aggressive-query headroom / simulator max-affordable solve)
2. "Pause savings contributions to free up $Y/day" (gentlest real lever)
3. Then Tier 3 cuts → Tier 2 → etc. (the existing tier checklist)

Savings sits *above* the tier system as the first lever, not inside it.

## A3. Optional auto-unpause date on pause

When pausing a goal (either type), offer an **optional auto-unpause date** (field empty by default — some pauses are genuinely open-ended).

- If set, the goal auto-resumes on that date (target → re-run the date flow; continuous → resume previous rate — same as manual unpause, just date-triggered).
- Rationale: the resume-action is exactly the kind of intention that never happens by neglect (activation-energy trap). Auto-unpause lets the user pre-commit to their own intention so the goal wakes itself instead of depending on them remembering.
- In the **deficit-mode "pause savings" flow**, PRE-FILL the auto-unpause date with the next income event / the date the deficit resolves — "pause savings until [next payday], when your budget recovers." Turns an open-ended drift into a bounded, self-healing pause.

**Auto-unpause feasibility re-check (important — don't walk them back into the hole):** when the auto-unpause date arrives, re-check whether resuming the contribution would breach the buffer.
- If fine → silent resume.
- If resuming would breach the buffer (deficit still ongoing) → do NOT silently resume into a breach. Prompt: "Your [goal] was set to resume today, but your budget's still tight — resume anyway, or extend the pause?"

### Test additions
- [ ] Spending from a target goal decrements accumulatedTotal AND recedes the projected date, with an informed-consent prompt showing old→new date
- [ ] Spending from a target goal does NOT auto-pause it (default); only offers pause at the near-zero extreme
- [ ] Savings goals do NOT appear in the deficit-mode tier-cut checklist
- [ ] Deficit mode surfaces "pause savings" as the first lever, above Tier 3 cuts
- [ ] Pause offers an optional auto-unpause date (empty by default)
- [ ] Deficit-mode pause pre-fills auto-unpause with next payday
- [ ] Auto-unpause silently resumes when feasible; prompts instead of silently resuming if it would breach the buffer

## A1 — REFINED (supersedes the A1 above; build this version)

Spending from a target goal has TWO legitimate intents, distinguished by one question. Do NOT build two flows — build ONE fork at spend time.

**The two intents:**
- **Part of the goal** (rational/common for purpose-funds): the spend IS part of what the goal was for, just spent early (e.g. booking flights out of the "Hawaii Trip" fund). The $400 was always meant for this → **lower the target by $400**. The goal is now partly fulfilled, not set back.
- **A withdrawal** (the defining case for emergency funds): money taken out for something unrelated, but the user still wants the original target (e.g. car repair from the emergency fund; target is still "3 months expenses"). → **keep the target, decrement accumulated, recede the completion date.** They rebuild.

Note: the "withdrawal, keep target" case is NOT irrational — it's the *expected* behavior for an emergency fund, the most important goal type. Must be supported.

**The interaction — one question, two radio options, live consequence preview:**
> Spending $400 from "[Goal]." Is this:
> ◯ Part of the goal (e.g. booking the flights) — lowers target to $[X−400]
> ◯ A withdrawal — keeps target, moves completion to [new date]

Show the live consequence on each branch as they select.

**Default to "A withdrawal" (keep target, recede date)** — it's the conservative/safer default. Silently shrinking a target is the worse error (someone raids their down-payment fund and the app quietly decides their down payment is now smaller). Lowering the target should be a deliberate opt-in the user actively picks and sees, never the silent default.

Both branches still decrement `accumulatedTotal` by the spent amount and (per Stage 5) file a real expense transaction against total balance — the fork only changes whether `targetAmount` also drops or stays.

### Test additions (refined A1)
- [ ] Spending from a target goal presents the two-option fork (part-of-goal vs withdrawal) with live consequence on each
- [ ] "Part of the goal" lowers targetAmount by the spend; "Withdrawal" keeps targetAmount and recedes the date
- [ ] Default selection is "Withdrawal" (never silently lowers the target)
- [ ] Both branches still file the real expense transaction + decrement accumulatedTotal (Stage 5 behavior intact)

## A1 — clarification on the "Withdrawal" branch (date recompute behavior)

When the user picks "A withdrawal" (keep target, recede date), keep it FRICTION-FREE — do NOT bombard with contribution-rate decisions:

- **Preserve the existing cadence and per-period amount exactly as the user already set them.** Spending from the goal changes the *balance*, not the user's chosen contribution pace or intent. Do not snap to "most aggressive."
- **Recede the completion date** = recompute based on (new lower accumulatedTotal + the SAME existing contribution rate). Let the date absorb the change; hold the plan constant.
- **Show the new date as a simple confirmation**, e.g. "You spent $400 from [Goal]. At your current $200/week, you'll now reach it by [new date]." One line. No fork, no extra prompt.
- **Do NOT offer an inline "want to stay aggressive / keep your original date?" option.** That's decision-bombardment for a minority case. If the user wants the original date back, they use the EXISTING edit-goal flow to bump their contribution — the capability already lives there. Route the rare case to the edit tool; don't promote it inline.

Rationale: spending from savings (esp. emergency-fund use) may happen often, so the flow must be lightweight — tap, spend, see new date, done. The aggressive-recovery path stays *available* (edit goal) but not *promoted* (no inline prompt).

### Test addition
- [ ] Withdrawal branch holds existing cadence + amount, recedes date, shows a one-line new-date confirmation, and does NOT present an inline re-aggress option
