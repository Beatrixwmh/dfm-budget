# DFM Budget Calculator — Unified Refactor Spec

## Context

Stages 1-3 (engine, data layer + input UI, dashboard + bar chart) are built and working. This spec covers corrections to existing code, missing features, and remaining new features. Apply changes in the order listed — each stage depends on the previous one.

**Execution order:** Stage 1 (engine fixes) → Stage 2 (data model) → Stage 3 (transactions + trends) → Stage 4 (tiers + deficit) → Stage 5 (what-if simulator)

---

## Corrective Stage 1: Engine Fixes

### 1A. DFM Formula — Sustainable Rate Cap

**Problem:** With a rolling 730-day window, DFM decreases daily even when nothing changes. The surplus (B₀) gets re-spread across a perpetually renewing 730-day horizon, causing the number to asymptotically decay toward the sustainable rate. This feels like a bug to the user.

**Fix:** Cap DFM at the sustainable rate.

```
sustainable_rate = cumulative_events(730) / 730

raw_dfm = min over t=1..730 of (B₀ + cumulative_events(t) - buffer) / t

DFM = min(raw_dfm, sustainable_rate)
```

**Behavior:**
- When surplus exists: raw_dfm > sustainable_rate, so DFM = sustainable_rate. Number stays stable daily.
- When a near-term pinch point exists: raw_dfm < sustainable_rate, so DFM = raw_dfm. Number drops to reflect a genuine problem.
- Net effect: DFM is stable by default and only drops when something real changes.

### 1B. Bar Chart Derivation — Use Days Until Next Income

**Problem:** The bar chart was using days until pinch point for the allocation calculation. This creates confusing allocations across distant time horizons.

**Fix:** Use days until next income event as the time horizon for the bar breakdown.

```
t_bar = days until next income event (e.g., next paycheck)

total_allocated = B₀ - (DFM × t_bar) - buffer
```

**Bar segments:**
1. **Named obligations** — expenses due between now and next income, proportional to their scheduled amounts in that window
2. **Future reserves** — gap between total_allocated and sum of named obligations. Absorbs complexity of distant commitments without trying to visualize them
3. **Buffer** — safety floor
4. **Free money** — what remains. The number the user looks at before buying something

### 1C. Projected Balance Chart — Payday Snapshots

**Problem:** Daily balance plotting creates a sinusoidal/sawtooth pattern (lump income, continuous spending) that's hard to read.

**Fix:** Default view plots balance on each payday only, not every day. This collapses intra-period oscillation into a clean series showing the financial trajectory at each reset point.

**Implementation:**
- Identify all income event dates in the 730-day window
- Calculate projected balance at each income date (assuming DFM daily spending)
- Plot these points as the default chart view
- Optional toggle: "Show daily detail" switches to the raw daily balance line for users who want granularity

---

## Corrective Stage 2: Data Model Refactor

### 2A. Extend Expense Type

Add these fields to the existing Expense type:

```typescript
// ADD to existing Expense type
tier: 0 | 1 | 2 | 3;          // 0=Can't Cut, 1=Must Pay, 2=Important, 3=Nice to Have
isAutoCut: boolean;             // true if deficit engine has cut this
targetAmount?: number;          // savings_goal: the target
targetDate?: string;            // savings_goal: optional deadline (ISO date)
currentSaved?: number;          // savings_goal: amount saved so far
savingsMode?: 'target_date' | 'fixed_contribution';  // savings_goal only
```

**Expense type enum should include:** `recurring`, `one_time`, `subscription`, `savings_goal`

**Behavioral difference between recurring and subscription:**
- `subscription`: auto-charged, auto-generates a transaction on due date with no user action
- `recurring`: requires manual confirmation. Surfaces a prompt on due date asking user to confirm payment

**Tier defaults by type:**
- Tier 0 (Can't Cut): rent, mortgage, minimum loan payments
- Tier 1 (Must Pay): utilities, insurance, groceries
- Tier 2 (Important): gym, savings contributions
- Tier 3 (Nice to Have): streaming, hobby subscriptions

Auto-suggest tier based on category, user can override.

### 2B. Add Transaction Type

New type:

```typescript
interface Transaction {
  id: string;                    // crypto.randomUUID()
  date: string;                  // ISO date, YYYY-MM-DD
  amount: number;                // positive = income, negative = expense
  expenseId?: string;            // links to the planned expense this fulfills
  categoryId: string;            // FK to Category
  description: string;           // user-entered or auto-filled from expense name
  source: 'manual' | 'auto';    // auto = subscription auto-logged
}
```

### 2C. Extend Storage

- Add transactions array to AppState
- Persist to localStorage alongside existing data
- Include in JSON export/import

```typescript
interface AppState {
  // ... existing fields ...
  transactions: Transaction[];
}
```

### 2D. Update Expense Forms

- Add tier selection (dropdown or drag-and-drop) to expense creation/edit
- Add expense type selection that includes `subscription` and `savings_goal`
- For `savings_goal` type: show target amount, target date (optional), savings mode toggle
- Tier auto-suggest based on category selection

### 2E. Update Any Components That Break

- Any component reading Expense type needs to handle new optional fields
- Dashboard should not break — new fields are optional/have defaults
- Engine should not break — DFM calculation doesn't depend on tiers (tiers only matter in deficit mode)

---

## Corrective Stage 3: Transaction Tracking

### 3A. Upcoming Expenses Card (Dashboard)

Three sections on the dashboard for expense management:

**Section 1: Overdue**
- Recurring expenses past due with no confirmation
- Red styling, most prominent
- Two buttons per item:
  - **Paid** → opens amount confirmation (pre-filled with expected amount, editable), generates transaction AND subtracts from balance in one action. Hold releases
  - **Defer** → snoozes for 1 day, resurfaces tomorrow. Hold remains
  - **"This didn't happen"** → releases hold, money returns to free, expense reschedules to next cycle
- Subscriptions never appear here (auto-logged)

**Overdue hold mechanism:**
- Unconfirmed overdue expenses are NOT subtracted from balance but are quarantined from free money
- `effective_balance = B₀ - sum(unconfirmed overdue amounts)`
- Use `effective_balance` instead of `B₀` for ALL DFM and bar calculations
- Bar chart shows held amount as its own amber/yellow segment: "Pending: Rent $1,500 (3 days overdue)"
- Overdue expenses are removed from the future timeline (due date has passed) but NOT assumed paid
- DFM stays accurate throughout because effective_balance accounts for the hold

**Defer escalation tiers:**
- Days 1-3: Normal overdue card. Defer available
- Days 4-7: Card turns more urgent styling. Shows: "[Expense] is [N] days overdue — $[amount] held from free money." Defer still available
- Day 7+: Defer is REMOVED. Only two options remain: "I paid this" (confirm + subtract) or "This didn't happen" (release hold, reschedule). Forces resolution. No more snoozing

**Section 2: Today / Tomorrow**
- Expenses due today or tomorrow
- Subscriptions show as "auto-paid" with checkmark (already logged)
- Recurring expenses show **Pay Now** button → same flow as Paid above
- Gives user a heads-up on what's about to hit

**Section 3: Upcoming (collapsible)**
- Collapsed by default to keep dashboard clean
- Shows next occurrence of every other future recurring expense, sorted by date
- Each item shows: name, amount, date, category color dot
- **Pay Early** button on each → generates transaction now, marks this cycle as fulfilled, removes this occurrence from the future cash event timeline, next occurrence advances to following cycle. DFM recalculates immediately (may dip briefly as early payment draws from free money, but recovers as the removed future obligation frees up the timeline)
- Useful for: "I have extra cash, let me knock out next month's insurance early"

### 3B. Expense Confirmation Flow

**On due date for `recurring` expenses:**
- Surface a card/notification on the dashboard: "[Expense name] $[amount] was due [date] — Paid?"
- Three options:
  - **Paid** → generates transaction at expected amount, links to expense via expenseId
  - **Edit** → opens amount editor, then generates transaction at edited amount
  - **Not yet** → snoozes, resurfaces next day

**On due date for `subscription` expenses:**
- Auto-generate transaction silently (amount and date are always exact)
- Show in transaction list with source: 'auto'
- User can edit or delete if the actual charge differed

**Past-due expenses:**
- If a recurring expense due date has passed with no confirmation, surface it prominently: "Rent was due 3 days ago — have you paid it?"

### 3C. Quick-Add for Unplanned Spending

- Button on dashboard: "Log Expense" or "+"
- Fields: amount (required), category (dropdown, required), description (optional), date (defaults today)
- No linked expense — this is for unplanned spending (Taco Bell, impulse buys)
- Balance auto-adjusts downward
- DFM recalculates

### 3D. Transaction List View + Trends

- New tab: "Transactions"
- Two sub-views, togglable: **List** (default) and **Trends**

**List view:**
- List sorted by date (newest first)
- Filter by: category, date range, planned vs unplanned
- Each entry shows: date, description, amount, category color dot
- Linked transactions show the expense name they fulfilled
- Swipe to delete (with undo)

**Trends view:**
- Empty state when insufficient data: "Log more transactions to see trends"
- **Category spending over time:** bar chart, monthly spending by category (stacked bars). Time range selector: 1 month, 3 months, 6 months, 12 months. Data source: transactions grouped by category and month
- **DFM history:** line chart showing DFM value over time. Requires logging DFM daily (add to storage: `dfmHistory: { date: string, dfm: number }[]`)
- **Spending vs budget:** per category, budgeted (from expense estimates) vs actual (from transactions). Simple bar comparison, highlights categories where actual exceeds estimate

### 3E. Balance Auto-Update

- Confirming a transaction (paid button) subtracts from balance AND releases the overdue hold in one action — these are not separate steps
- Quick-add transactions also subtract from balance immediately
- Subscription auto-transactions subtract from balance on due date
- DFM recalculates immediately after any balance change
- Show delta on DFM: "$42/day → $41/day" briefly after transaction
- All DFM and bar calculations use `effective_balance` (B₀ minus overdue holds), not raw B₀

---

## Corrective Stage 4: Tiers + Deficit Mode

### 4A. Tier Assignment UI

- In expense edit screen: tier selector (0-3) with labels
  - 0: Can't Cut (rent, mortgage)
  - 1: Must Pay (utilities, insurance)
  - 2: Important (gym, savings)
  - 3: Nice to Have (streaming, hobbies)
- Auto-suggest based on category, user overrides

### 4B. Deficit Mode Logic

When DFM would be negative (even spending $0/day, balance hits buffer):

**Interactive tier-based cutting:**

1. Calculate total amount that needs to be freed per month to resolve deficit
2. Surface Tier 3 expenses as a checklist, sorted by amount descending
3. Running total shown as user checks boxes: "$0 of $X freed" → "$15.99 of $X freed" → ...
4. Once freed amount >= needed amount, "Apply" button activates
5. If entire tier insufficient: "Cutting all of Tier 3 frees $Y but you need $X. Move to Tier 2?" → surfaces Tier 2 checklist
6. Same flow for Tier 1 if needed
7. Tier 0 is NEVER surfaced for cutting

**Auto-select fallback:** "Auto-select for me" button cuts largest-first within the current tier. For users who don't want to choose manually.

Set `isAutoCut: true` on any expense cut by this process.

**Default tier:** All new expenses default to Tier 2 (Important). This makes deficit mode functional out of the box. Users actively PROMOTE critical expenses to Tier 0/1 rather than demoting unimportant ones. On first deficit, surface a warning: "These expenses will be cut — review tiers to protect anything important."

### 4C. Deficit Mode UI

- Cut expenses get a red indicator in the expense list
- DFM display turns red with message: "Even spending $0/day, you'll hit your buffer by [pinch point date]"
- Show which tiers were cut and how much was freed
- If unresolvable (tier 0 alone exceeds income): special message, deficit amount shown

### 4D. Auto-Restore

- When budget improves (income added, expense removed, balance updated):
- Restore cut expenses from tier 1 upward
- Set `isAutoCut: false`
- Recalculate DFM

---

## Stage 5: What-If Simulator

### 5A. Hypothetical Expense Entry

- Accessible from its own tab or a "What if...?" button on the dashboard
- Input: amount, frequency (one-time or recurring), category, description, start date
- Multiple hypotheticals can be stacked simultaneously
- Each hypothetical shows as a distinct card with a remove button

### 5B. Real-Time Impact Display

- DFM recalculates in real-time as hypotheticals are added/removed
- Show delta prominently: "DFM: $42/day → $37/day (−$5)"
- Show new pinch point if it changed: "Pinch point moves from Aug 15 to Jul 22"
- Projected balance chart updates to show the hypothetical scenario overlaid on current (dashed line vs solid line)
- Bar chart updates to show how free money would change

### 5C. Tier Impact Preview

- If a hypothetical would trigger deficit mode: "Adding this expense would cut 2 Tier 3 expenses"
- List which expenses would be affected
- Show the deficit resolution flow that would trigger (same interactive checklist from Stage 4, but in preview mode — nothing actually cut)

### 5D. Apply or Discard

- **Apply** button converts a hypothetical into a real expense (moves to expense list, DFM permanently recalculates)
- **Apply All** if multiple hypotheticals stacked
- **Clear All** resets simulator to clean state
- Closing the simulator without applying discards all hypotheticals — no persistent side effects

---

## Future Additions (Not In This Spec)

- Variable estimate nudges (needs 3+ months of transaction data)
- Savings goal progress tracking with pace alerts
- Auto-suggest on transaction entry from history
- Markdown export for OpenClaw
- Expense tier drag-and-drop reordering

---

## Testing Checklist

After each corrective stage, verify:

**After Stage 1 (Engine):**
- [ ] DFM stays stable day-over-day when no data changes
- [ ] DFM drops when a real pinch point exists below sustainable rate
- [ ] Bar segments sum to current balance
- [ ] Bar uses days-until-next-income, not pinch point
- [ ] Projected chart shows payday snapshots by default

**After Stage 2 (Data Model):**
- [ ] Existing expenses still load correctly (backwards compatible)
- [ ] New expenses can be created with tiers
- [ ] Subscription vs recurring type can be set
- [ ] Transactions persist in localStorage
- [ ] JSON export includes transactions

**After Stage 3 (Transactions + Trends):**
- [ ] Subscription auto-generates transaction on due date
- [ ] Recurring expense surfaces confirmation prompt
- [ ] Overdue expenses surface prominently with paid/defer
- [ ] Overdue hold: effective_balance reduces by overdue amount
- [ ] Overdue hold: bar shows amber "Pending" segment for held amount
- [ ] Overdue hold: DFM uses effective_balance, not raw balance
- [ ] Paid button subtracts from balance AND releases hold in one action
- [ ] "This didn't happen" releases hold and reschedules expense
- [ ] Defer escalation: day 7+ removes defer option, forces resolution
- [ ] Pay Early removes future occurrence and recalculates DFM
- [ ] Quick-add creates transaction and adjusts balance
- [ ] DFM recalculates after transaction
- [ ] Transaction list shows all entries with filters
- [ ] Trends toggle works within transactions tab
- [ ] Category spending chart renders from transaction data
- [ ] DFM history tracks over time
- [ ] Spending vs budget comparison works per category

**After Stage 4 (Tiers + Deficit):**
- [ ] Negative DFM triggers interactive tier-based cutting
- [ ] Correct cut order: tier 3 → 2 → 1 → never 0
- [ ] User can select which expenses to cut with running total
- [ ] Auto-select fallback cuts largest-first
- [ ] Cut expenses marked visually
- [ ] Restores automatically when budget improves
- [ ] Default tier is 2 for new expenses

**After Stage 5 (Simulator):**
- [ ] Adding hypothetical expense updates DFM in real-time
- [ ] Delta shown clearly (old → new)
- [ ] Multiple hypotheticals can be stacked
- [ ] Pinch point updates if changed
- [ ] Projected balance chart shows hypothetical overlay
- [ ] Tier impact preview shows which expenses would be cut
- [ ] Apply converts hypothetical to real expense
- [ ] Clear All discards without side effects
- [ ] Closing simulator without applying leaves no changes
