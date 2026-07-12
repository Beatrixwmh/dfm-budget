# DFM Budget Calculator — Remaining Stages Plan

> **STATUS (Jul 12, 2026): ALL PHASES COMPLETE.** Phases 1–4 built and verified.
> Phase 5 shipped via **GitHub Pages** instead of Vercel (repo made public with
> Beatrix's approval): Actions workflow tests + builds + deploys every push to
> master. Live at **https://beatrixwmh.github.io/dfm-budget/** — permanent URL,
> PWA-installable. Tunnels retired.

## Context

As of commit `54122f0`, everything in the three specs is built **except**:
1. The **What-If Simulator** (original spec Stage 4; corrective spec Stage 5) — currently a stub page, with a live "Open Simulator →" link pointing at it from the goal form.
2. **Deficit Mode** (corrective spec Stage 4) — tier fields and `isAutoCut` exist, but there is no cutting engine, no resolution UI, and no auto-restore. The dashboard just turns the DFM number red.
3. **Deployment** (original spec Stage 5) — the app runs off a local dev server + ephemeral Cloudflare tunnels; no permanent URL, no PWA manifest.

This plan sequences those into five phases. The ordering exists because the simulator and deficit mode share a computational core, and building that core first (Phase 1) means neither feature duplicates engine logic.

**UPDATE (Jul 2026) — the free-money reframe.** The original spec's framing of DFM-per-day as the headline number was a design error. The user-facing answer is a STOCK, not a rate: "how much of my balance is actually free right now." DFM (the rate) is backend machinery with three jobs: stabilizing free money over time (sustainable cap), aggressive-savings capacity (rawDfm), and the impulse-spend ceiling. This is now built: the dashboard hero shows **Free to spend** (conservative DFM × days to next income — refills each payday) with the **splurge ceiling** (`maxSpendToday` in `engine/dfm.ts`: min future balance − buffer, aggressive query) as a secondary line. All user-facing copy says "free money," never "DFM." Anything below that references "the headroom line" or DFM displays should be read through this lens — dollars available, rates as small print.

**Execution order:** Phase 1 (engine extraction) → Phase 2 (simulator MVP) → Phase 3 (deficit mode) → Phase 4 (simulator × deficit integration) → Phase 5 (deploy + PWA).

Phases 2 and 3 are independently shippable; 4 requires both; 5 can happen any time after 2 but makes most sense last so the deployed app is feature-complete.

---

## What changed since the old specs were written

The simulator and deficit-mode sections of the corrective spec predate the savings refactor, the multi-segment projection, overdue holds, and the recurrence overhaul. This plan adapts them:

- **Schedules** are now `interval + unit`, not a frequency enum — hypothetical recurring expenses reuse the existing `ScheduleForm`.
- **Savings exists** — hypotheticals must show their effect on savings capacity (a big enough hypothetical freezes contributions before it creates a deficit), and per addendum A2, "pause savings" is the first deficit lever, above all tier cuts.
- **DFM is two-tier** (conservative spend number vs aggressive `rawDfm`) — the simulator's "max affordable" solve uses the aggressive query, same as savings capacity.
- **Balance is split** (spendable vs vault) — deficit detection and all simulator math run on the spendable pool, consistent with `useDfmEngine`.

---

## Phase 1: Engine Extraction (foundation, no behavior change)

**Problem:** the full DFM pipeline (paid-occurrence filtering → spendable split → rawDfm → savings capping → vault simulation → segments) lives inline in `useDfmEngine`. The simulator needs to run this pipeline **twice** (real state vs real+hypothetical), and deficit mode needs to run it **speculatively** (what if these expenses were cut). Copying the hook is how the balance-dips-below-savings bug happened last time — two half-copies of the same math drifting apart.

**Change:** extract the body of `useDfmEngine` into a pure function:

```typescript
// engine/snapshot.ts
export interface SnapshotOptions {
  extraEvents?: CashEvent[];        // simulator: hypothetical events to merge in
  excludeExpenseIds?: Set<string>;  // deficit: expenses to treat as cut
  pauseAllSavings?: boolean;        // deficit lever 2 preview
}

export function computeSnapshot(state: AppState, today: Date, opts?: SnapshotOptions): DfmEngineOutput
```

`useDfmEngine` becomes a thin `useMemo(() => computeSnapshot(state, new Date()), [state])`. All existing tests keep passing; add snapshot-level tests (the engine test file currently tests the sub-functions, not the composed pipeline).

**Also in this phase:** ~~a `maxAffordableToday(state)` helper~~ **DONE early** — shipped as `maxSpendToday` in `engine/dfm.ts` during the free-money reframe; it already powers the dashboard splurge line and will power deficit lever 1.

**Testing checklist:**
- [ ] All 46 existing tests still pass; hook produces identical output to before (golden test on testData)
- [ ] `extraEvents` merges and sorts correctly with generated events
- [ ] `excludeExpenseIds` removes an expense's entire future event stream
- [ ] `maxAffordableToday` = 0 when at buffer; equals surplus when flush; never negative

---

## Phase 2: What-If Simulator MVP

**Deliverable:** the Simulator tab does what both specs promised, minus tier-impact preview (Phase 4).

### Data model — ephemeral, not persisted

```typescript
interface Hypothetical {
  id: string;
  description: string;
  amount: number;               // positive entry, applied as negative event(s)
  kind: 'one_time' | 'recurring';
  date: string;                 // one_time: the date
  schedule?: Schedule;          // recurring: reuses interval+unit ScheduleForm
  categoryId: string;
}
```

- Lives in React state via a `SimulatorContext` (sibling of `NavContext`), **not** localStorage — closing the app discards hypotheticals (spec: "no persistent side effects").
- Held in context, not page state, so tab-switching to Dashboard and back doesn't wipe the scenario mid-comparison.

### Computation

- `baseline = computeSnapshot(state, today)` (already computed by the app).
- `scenario = computeSnapshot(state, today, { extraEvents: eventsFromHypotheticals(hypos) })`.
- Recurring hypotheticals generate events through the same scheduler as real expenses.

### UI (Simulator tab)

1. **Headroom line** — now lives on the dashboard hero (the splurge line), so the simulator instead opens with the current free-to-spend + splurge numbers as its baseline readout, then shows how each hypothetical moves them.
2. **Add hypothetical** — amount, description, one-time (date picker) vs recurring (ScheduleForm), category. Footer-locked save button like every other form.
3. **Hypothetical cards** — one per entry, amount/cadence/description, remove button. "Clear all" resets.
4. **Impact panel** (live, recomputes on every add/remove):
   - DFM delta: "$42/day → $37/day (−$5)" — color-coded.
   - Pinch point shift: "Pinch point moves from Aug 15 to Jul 22" (only when it changed).
   - Savings impact when scenario `cappedSavings` < baseline: "This would throttle savings by $X/day" or "This would **freeze** your savings contributions" (auto-freeze preview).
   - Deficit warning when scenario DFM < 0: "This puts you in deficit — even at $0/day you'd hit your buffer around [date]." (Full lever/tier preview arrives in Phase 4.)
5. **Chart overlay** — ProjectedBalanceChart gains an optional `scenarioBalances` prop: baseline solid, scenario dashed, same payday/daily toggle. Markers only from baseline (scenario markers would double the clutter — the dashed line itself shows the divergence).
6. **Apply** — converts a hypothetical to a real expense (one-time → `one_time` expense today-dated, recurring → `recurring` expense) via existing ADD_EXPENSE, then removes it from the scenario. "Apply all" batches. Applying an unscheduled *past-tense* spend is what Quick-Add is for; the simulator only creates planned expenses.

### Testing checklist
- [ ] Adding a hypothetical updates DFM delta in real time; removing restores baseline exactly
- [ ] Multiple hypotheticals stack (deltas compose)
- [ ] Recurring hypothetical generates correct event stream (every-N schedules included)
- [ ] Scenario overlay renders dashed and never mutates baseline data
- [ ] Savings throttle/freeze preview appears when scenario cappedSavings drops
- [ ] Apply creates a real expense and clears that hypothetical; Clear All leaves no side effects
- [ ] Goal form's "Open Simulator →" lands on the working tab
- [ ] Headroom number = 0 at buffer, matches pinch-balance − buffer otherwise

---

## Phase 3: Deficit Mode

**Deliverable:** when DFM goes negative, the app walks the user out of it — per corrective Stage 4 **restructured by addendum A2** (savings pause sits above the tier system, never inside it).

### Detection

`inDeficit = dfm.dailyFreeMoney < 0`. Because savings contributions are already capped at `rawDfm` (auto-freeze), a negative DFM is always a *structural* deficit — spending obligations alone breach the buffer. No savings math can cause it.

### Deficit engine (pure, in `engine/deficit.ts`)

```typescript
interface DeficitPlan {
  deficitPerDay: number;              // |DFM|
  neededPerMonth: number;             // deficitPerDay × 30.44 (display)
  pausableSavingsPerDay: number;      // lever 2: sum of active goals' rates (may be 0 — already frozen)
  tiers: Array<{
    tier: 1 | 2 | 3;
    candidates: Array<{ expenseId: string; name: string; freedPerDay: number }>;
  }>;                                 // tier 0 NEVER included
  resolvable: boolean;                // false if cutting everything above tier 0 still isn't enough
}

export function planDeficit(state: AppState, today: Date): DeficitPlan
export function simulateCuts(state: AppState, today: Date, cutIds: Set<string>): DfmResult  // via computeSnapshot excludeExpenseIds
```

`freedPerDay` per expense comes from re-running the snapshot without it (exact, respects pinch structure) — done lazily per tier, not for all expenses upfront, to keep it fast.

### Resolution UI

**Dashboard banner** (replaces the current silent red number):
> "Even spending $0/day, you'll hit your buffer by [pinch date]. You're short **$X/mo**." → **[Fix this]** button.

**Resolution modal — levers in A2 order:**
1. **Headroom fact** (context, not a button): "You have $X above your buffer" — from `maxAffordableToday`. In a real deficit this is ~$0 and says so; it exists so the hierarchy reads honestly.
2. **Pause savings** — first actionable lever, only shown if any goal is active. "Pause contributions to free $Y/day" with the auto-unpause date **pre-filled to the next income event** (A3: bounded, self-healing pause). Uses the existing pause + auto-unpause machinery. If savings are already auto-frozen, show that as a done state, not a button.
3. **Tier cuts** — checklist starting at Tier 3, sorted by freed amount descending. Running total: "$31.98 of $87 needed freed." Checking boxes live-recomputes via `simulateCuts`. When a tier is exhausted and it's still not enough: "Cutting all of Tier 3 frees $Y but you need $X — move to Tier 2?" Tier 0 is never surfaced.
4. **Auto-select for me** — largest-first within the current tier until covered.
5. **Apply** — enabled once projected DFM ≥ 0; sets `isAutoCut: true` on chosen expenses (they stay in the list, excluded from event generation, red "cut" badge in the expense panel).
6. **Unresolvable case** — if tier 0 alone exceeds income: no checklist theater, a plain statement of the structural shortfall per month.

**First-deficit tier warning** (spec 2 4B): most expenses default to Tier 2, so on the first deficit ever show: "These are cuttable — review tiers to protect anything important" with a jump to the expense list. One-time flag in AppState (`hasSeenDeficitWarning`).

### Auto-restore

On every state change while any `isAutoCut` expense exists: try restoring cut expenses **tier 1 first, then 2, then 3** (essentials come back first), largest-first within a tier, greedily — restore each only if the snapshot with it restored keeps DFM ≥ 0. Runs in a `useDeficitRestore` hook mirroring `useAutoUnpause`. Restored expenses get `isAutoCut: false` and a brief "restored" toast.

### Engine change required

`generateCashEvents` must skip `isAutoCut` expenses (currently the flag is stored but ignored). This is the one behavior change to existing engine code — gated and tested.

### Testing checklist
- [ ] Negative DFM shows banner with pinch date and monthly shortfall
- [ ] Lever order: headroom fact → pause savings (pre-filled auto-unpause = next payday) → Tier 3 → 2 → 1; Tier 0 never listed
- [ ] Running total updates live; Apply disabled until DFM ≥ 0
- [ ] Auto-select picks largest-first within tier
- [ ] Cut expenses: excluded from events, badge in list, still visible/editable
- [ ] Auto-restore: adding income restores tier 1 first, never re-triggers deficit, clears isAutoCut
- [ ] Unresolvable deficit states the shortfall without a checklist
- [ ] First-deficit tier warning shows exactly once
- [ ] Savings goals never appear in the cut checklist (A2)

---

## Phase 4: Simulator × Deficit Integration

Small phase — wiring, not new machinery.

- **Tier impact preview** (spec 2 5C): when a hypothetical pushes the scenario DFM negative, the simulator's deficit warning expands to the lever preview: "would freeze savings ($Y/day)" and "would cut: [Netflix $0.53/day, Gym $1.32/day] (Tier 3)" — computed by running `planDeficit` + auto-select on the *scenario* state. Preview only; nothing is cut until the hypothetical is applied and the real deficit flow runs.
- **Deficit modal → simulator escape hatch**: a "test a different change instead" link from the resolution modal into the simulator (e.g., user would rather model dropping to part-time gym than cut it).

### Testing checklist
- [ ] Deficit-inducing hypothetical lists exactly the expenses auto-select would cut, in preview only
- [ ] Applying the hypothetical then triggers the real deficit banner with matching numbers
- [ ] No cuts/pauses occur from preview alone

---

## Phase 5: Deploy + PWA

**Goal:** permanent URL, installable on the phone, no more tunnel roulette.

1. **Vercel** — repo already has a GitHub remote (`Beatrixwmh/dfm-budget`). Push, import the repo in Vercel's dashboard (requires Beatrix's login — the one step Claude can't do), framework preset Vite, done. Every push to master auto-deploys.
2. **PWA manifest** — `manifest.webmanifest` (name, theme `#1a1c23`, icons from existing `favicon.svg` rendered to 192/512 PNG), `display: standalone`, registered in `index.html`. "Add to Home Screen" then behaves like an app. A service worker is **optional** — skip initially (localStorage works offline anyway once loaded; a stale-asset SW bug is worse than no SW). Revisit only if offline-launch matters.
3. **Data reality check, surfaced in-app**: localStorage is per-device — the deployed URL on the phone starts **empty**; it does not see the laptop's data, and the tunnel-era data on the phone lives under the old origin, so it won't carry over either. Bridge: Settings → Export on the laptop, Import on the phone. Add a one-line note in Settings ("Data lives on this device — use Export/Import to move it") so future-Beatrix isn't surprised.
4. **Housekeeping**: `allowedHosts: ['.trycloudflare.com']` in vite.config only affects the dev server — harmless, keep it for local phone testing.

### Testing checklist
- [ ] Production build (`vite build`) clean; deployed URL serves the app
- [ ] Lighthouse recognizes the manifest; installs to iOS home screen with icon + standalone chrome
- [ ] Export from laptop → import on phone round-trips all state (goals, transactions, schedules, holds)
- [ ] Old tunnel/localhost origins unaffected

---

## Out of scope (unchanged from corrective spec)

Variable estimate nudges, savings pace alerts, transaction auto-suggest, markdown export, tier drag-and-drop reordering, Tauri migration.
