# DFM Budget Calculator — Technical Spec

## Overview

A React web app that answers one question: **"How much can I safely spend per day?"**

The app tracks a single balance, projects all known future income and expenses across a 730-day rolling window, and calculates the maximum constant daily spending rate that never drops the balance below a safety buffer. This number — **Daily Free Money (DFM)** — recalculates every time the data changes, acting like a GPS that reroutes based on where you actually are financially.

**Tech stack:** React + TypeScript, localStorage for persistence, JSON export/import for backup. Designed for eventual migration to Tauri (desktop app) — the React frontend will drop into a Tauri shell unchanged, swapping localStorage for a Rust/SQLite backend.

**Deploy:** Vercel (free tier), mobile responsive.

---

## Core Algorithm

### Daily Free Money (DFM)

The maximum constant daily amount withdrawable without the projected balance ever dropping below the safety buffer at any point in the 2-year window.

```
DFM = min over all t in [1..730] of:
  (B₀ + cumulative_events(t) - buffer) / t
```

Where:
- **B₀** = current balance (total money on hand right now)
- **cumulative_events(t)** = sum of all signed cash events from day 1 through day t (positive = income, negative = expense)
- **buffer** = user-configured minimum balance floor (default: $0)

The day `t` that produces the minimum is the **pinch point** — the tightest future day.

### Key behaviors

- **Recalculates on every data change** — add an expense, DFM updates instantly
- **Recalculates daily based on actual balance** — if Alan splurges today, DFM drops tomorrow. If he's frugal, it rises. Self-correcting like GPS rerouting
- **DFM can be negative** — this means even spending $0/day, the balance will eventually hit the buffer. This triggers deficit mode

### Bar Chart (Balance Breakdown)

The horizontal stacked bar shows how much of the current balance is "spoken for" vs genuinely free. **Derived from DFM, not computed independently** — this guarantees the bar and the DFM number are always consistent.

```
total_allocated = B₀ - (DFM × t_pinch) - buffer
```

This total is then broken down by category based on the actual scheduled payments between now and the pinch point.

**Bar segments:**
1. **Named obligations** (by category) — expenses due between now and the pinch point, proportional to their scheduled amounts in that window. Each segment shows the expense name and amount
2. **Future reserves** — the gap between what DFM math allocates and what's accounted for by named obligations. This absorbs the complexity of the pinch point without trying to explain it visually
3. **Buffer** — the safety floor
4. **Free money** — what's left. This is the number Alan looks at before buying something

Tap any segment to see details.

---

## Data Model

### Balance

| Field | Type | Notes |
|-------|------|-------|
| currentBalance | number | Total money on hand. Updated manually |
| lastUpdated | ISO date string | When balance was last set |

One number. No individual bank accounts.

### Category

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| name | string | e.g., "Housing", "Food", "Transport" |
| color | hex string | For bar chart segments |
| sortOrder | number | Display ordering |

Flat categories only. Created before expenses so expenses can reference them.

### IncomeSource

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| name | string | e.g., "Day Job" |
| amount | number | Per occurrence |
| isVariable | boolean | If true, treated as estimate |
| schedule | Schedule | See Schedule type below |

### Expense

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| name | string | e.g., "Rent", "Spotify" |
| amount | number | Per occurrence |
| categoryId | string | FK to Category |
| type | enum | "recurring" \| "one_time" \| "subscription" |
| isVariable | boolean | |
| schedule | Schedule \| null | Null for one-time |

### Schedule

| Field | Type | Notes |
|-------|------|-------|
| frequency | enum | "weekly" \| "biweekly" \| "semimonthly" \| "monthly" \| "quarterly" \| "annual" |
| dayOfMonth | number \| null | For monthly (1-31, -1 for last day) |
| dayOfWeek | number \| null | For weekly/biweekly (0=Sun, 1=Mon... 5=Fri) |
| startDate | ISO date string | First occurrence |
| endDate | ISO date string \| null | Optional termination |
| weekendRule | enum | "as_is" \| "friday_before" \| "monday_after" \| "nearest_weekday" |
| holidayRule | enum | "as_is" \| "day_before" \| "day_after" \| "nearest_business_day" |

Resolution order: frequency → holiday rule → weekend rule (a holiday shift might land on a weekend, so weekend rule applies last).

### CashEvent (computed, not stored)

| Field | Type | Notes |
|-------|------|-------|
| date | ISO date string | When it hits |
| amount | number | Positive = income, negative = expense |
| sourceId | string | FK to IncomeSource or Expense |
| sourceName | string | For display |
| categoryId | string \| null | From expense, null for income |

Generated by the schedule resolver from income sources and expenses. These feed into the DFM algorithm.

### Holidays

US federal holidays built in: New Year's Day, MLK Day, Presidents' Day, Memorial Day, Juneteenth, Independence Day, Labor Day, Columbus Day, Veterans Day, Thanksgiving, Christmas. Saturday holidays observed Friday; Sunday holidays observed Monday.

User can add/remove custom holiday dates.

---

## Schedule Resolver

Port from existing Python `next_date` and `generate_dates` functions in the Colab notebook.

### next_date(schedule, referenceDate) → Date

Given a schedule configuration and a reference date, returns the next occurrence.

**Monthly logic:**
- If dayOfMonth = -1, find last day of next month
- If dayOfMonth > 0, same day next month (handle months with fewer days)
- Apply holiday rule: check against US federal holidays + custom holidays
- Apply weekend rule: shift if landing on Saturday/Sunday

**Weekly/biweekly logic:**
- Find next occurrence of dayOfWeek from reference date
- For biweekly, add 2 weeks from reference
- Apply holiday and weekend rules

### generate_dates(schedule, startDate, endDate) → Date[]

Generate all occurrence dates within a range. Calls next_date repeatedly, advancing from each result.

### JavaScript holiday library

Use `date-fns` for date arithmetic (lightweight, no Moment.js bloat). For US federal holidays, either use a small library or hardcode the rules — there are only 11 federal holidays and the rules are simple (e.g., "third Monday of January").

---

## Features by Stage

### Stage 1: Core Engine (no UI)

**Deliverable:** Pure TypeScript functions, testable with hardcoded data.

Files:
- `engine/dfm.ts` — DFM algorithm: takes balance, buffer, CashEvent[] → { dailyFreeMoney, pinchPointDate, pinchPointBalance, projectedBalances[] }
- `engine/scheduler.ts` — Schedule resolver: port of next_date and generate_dates from Python
- `engine/eventGenerator.ts` — Takes IncomeSource[] and Expense[], generates CashEvent[] for 730 days
- `engine/holidays.ts` — US federal holiday rules + custom holiday storage
- `engine/barChart.ts` — Bar breakdown: takes balance, DFM, buffer, pinchPoint, expenses between now and pinch → { segments[] }

**Verification:** Run DFM with Alan's actual income and expenses from the Colab notebook. Compare output against the Python version. Numbers should match.

**Alan's data for testing:**
- Income: biweekly on Fridays, $1,200/paycheck (from Colab cell 19)
- Expenses: ~15 liabilities from the Excel file (rent, loans, subscriptions — extract exact amounts from Colab)
- Balance: get current number from Alan

### Stage 2: Data Layer + Input UI

**Deliverable:** Working forms for all data entry, localStorage persistence, JSON backup.

Screens:
- **Categories:** Create/edit/delete with name and color picker. Must be set up before expenses
- **Income Sources:** Add/edit/delete with amount, schedule configuration (frequency, day, weekend/holiday rules)
- **Expenses:** Add/edit/delete with amount, category assignment, schedule configuration, type (recurring/one-time/subscription)
- **Settings:** Current balance input, safety buffer input, custom holidays
- **Backup:** "Export Data" button (downloads JSON), "Import Data" button (uploads JSON), with confirmation dialog on import

**Storage:** All data in localStorage under a single key as JSON. Stringify on every save, parse on load. Wrap in try/catch for corrupted data.

```typescript
interface AppState {
  balance: { currentBalance: number; lastUpdated: string };
  buffer: number;
  categories: Category[];
  incomeSources: IncomeSource[];
  expenses: Expense[];
  customHolidays: { date: string; name: string }[];
}
```

**Onboarding:** On first launch (no localStorage data), show a setup flow:
1. Add at least one income source (required)
2. Set current balance (required)
3. Optionally add categories and expenses

### Stage 3: Dashboard + Bar Chart

**Deliverable:** The main screen Alan sees every day.

Components:
- **DFM Display** — Big number, front and center. Updates reactively when any data changes. Show daily, weekly, and monthly equivalents (DFM × 1, × 7, × 30)
- **Pinch Point** — Date and projected balance on that day. "Your tightest day is [date] when your balance will be $[X]"
- **Projected Balance Chart** — Line chart (Recharts) showing balance over 730 days assuming DFM spending rate. X-axis: dates. Y-axis: dollars. Horizontal line at buffer level. Pinch point marked
- **Stacked Bar** — Horizontal bar showing current balance breakdown. Segments: obligations by category, future reserves, buffer, free money. Tap to inspect
- **Next 7 Days** — List of upcoming cash events (what's coming in and going out this week)

**Deficit Mode:** If DFM is negative, display changes:
- DFM number turns red
- Message: "Even spending $0/day, you'll hit your buffer by [pinch point date]"
- Show how much the deficit is
- Suggest which expenses to cut (future: this becomes the simulator)

### Stage 4: What-If Simulator

**Deliverable:** Alan can test hypothetical expenses before committing.

- Input field: "What if I spent $X on [thing]?" with date picker
- DFM recalculates in real-time showing the impact
- Show delta: "DFM would drop from $42/day to $37/day"
- Show if the hypothetical would create a new pinch point
- Stack multiple hypotheticals
- "Apply" button to convert a hypothetical into a real expense
- "Clear all" to reset

### Stage 5: Polish + Deploy

- Mobile responsive (touch-first, bottom tab bar on mobile)
- Vercel deployment
- Share link with Alan
- Loading states, error handling, empty states
- PWA manifest so it can be "installed" on phone home screen

---

## UI Layout

Touch-first. Bottom tab navigation on mobile, sidebar on desktop.

### Tabs

1. **Dashboard** — DFM, bar chart, next 7 days, pinch point
2. **Plan** — Income sources, expenses, categories (CRUD for all)
3. **Simulator** — What-if testing
4. **Settings** — Balance, buffer, holidays, backup/restore

### Design notes

- No keyboard shortcuts, no hover interactions — everything tap/click accessible
- DFM is always visible or one tap away from any screen
- When any data changes, DFM updates instantly (debounce 200ms for rapid edits)

---

## Edge Cases

### Financial
1. **Zero income:** DFM = negative immediately. Prompt to add income
2. **Expense on 31st of month:** Fall back to last day of shorter months
3. **Biweekly creates 26 pay periods/year:** Schedule resolver handles this naturally
4. **Holiday + weekend collision:** Holiday rule first, then weekend rule
5. **Variable income:** Use the entered estimate. Flag when actuals deviate significantly (future feature)
6. **Balance manually updated mid-day:** DFM recalculates from new B₀

### Technical
7. **localStorage full:** Extremely unlikely for a budget app (~5MB limit, budget data is <100KB). Show error if it happens
8. **Corrupted localStorage:** Try-catch on parse, offer to restore from JSON backup
9. **Browser clears localStorage:** This is why JSON export exists. Prompt user to back up periodically
10. **Rapid edits:** 200ms debounce on DFM recalculation

---

## Migration Path to Tauri

When the app outgrows a web deployment:

1. **Frontend (React) transfers unchanged** into Tauri's webview
2. **localStorage calls** get swapped for Tauri IPC commands to a Rust backend
3. **Rust backend** replaces localStorage with SQLite (the DFM algorithm is 15 lines in any language)
4. **API layer** from Alan's original spec can be added on top of the Rust backend for OpenClaw integration

The React code is the expensive part to build. The Rust backend is a thin data layer. Building React now and migrating later is the efficient path.

---

## Claude Code Session Plan

### Session 1: Stage 1 (Engine)
**Prompt:** "Build the core engine functions for a budget calculator in TypeScript. Here are the function signatures and algorithms..." + paste engine section above + Alan's test data from Colab

**Verify:** Run the DFM function with test data and check the output makes sense

### Session 2: Stage 2 (Data + UI)
**Prompt:** "Build React forms for managing budget data with localStorage persistence. Here are the data types..." + paste data model + storage section

**Verify:** Enter Alan's real expenses, refresh the page, confirm data persists

### Session 3: Stage 3 (Dashboard)
**Prompt:** "Build the dashboard that displays DFM, projected balance chart, and stacked bar chart using Recharts. Here's how DFM connects to the bar..." + paste dashboard + bar chart sections

**Verify:** Dashboard shows correct DFM number matching Stage 1 test output

### Session 4: Stage 4 (Simulator)
**Prompt:** "Add a what-if simulator that lets users add hypothetical expenses and see DFM impact in real-time..."

**Verify:** Add a hypothetical, confirm DFM changes, remove it, confirm DFM restores
