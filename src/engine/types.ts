export interface Balance {
  currentBalance: number;
  lastUpdated: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

/** "Every N <unit>" recurrence. */
export type ScheduleUnit = 'week' | 'month' | 'year';

/** Legacy frequency names — only used when migrating old saved data. */
export type ScheduleFrequency =
  | 'weekly'
  | 'biweekly'
  | 'semimonthly'
  | 'monthly'
  | 'quarterly'
  | 'annual';

export type WeekendRule =
  | 'as_is'
  | 'friday_before'
  | 'monday_after'
  | 'nearest_weekday';

export type HolidayRule =
  | 'as_is'
  | 'day_before'
  | 'day_after'
  | 'nearest_business_day';

export interface Schedule {
  /** Repeat every `interval` units (e.g. interval 6, unit 'month' = every 6 months). */
  interval: number;
  unit: ScheduleUnit;
  dayOfMonth: number | null;   // used when unit is 'month' or 'year'
  dayOfWeek: number | null;    // used when unit is 'week'
  semimonthlyDays?: [number, number]; // legacy twice-a-month (migrated data only)
  startDate: string;
  endDate: string | null;
  weekendRule: WeekendRule;
  holidayRule: HolidayRule;
}

export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  schedule: Schedule;
}

export type ExpenseType = 'recurring' | 'one_time' | 'subscription';

export type ExpenseTier = 0 | 1 | 2 | 3;

export const TIER_LABELS: Record<ExpenseTier, string> = {
  0: "Can't Cut",
  1: 'Must Pay',
  2: 'Important',
  3: 'Nice to Have',
};

export interface Expense {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  type: ExpenseType;
  schedule: Schedule | null;
  tier: ExpenseTier;
  isAutoCut: boolean;
}

export interface CashEvent {
  date: string;
  amount: number;
  sourceId: string;
  sourceName: string;
  categoryId: string | null;
}

export interface CustomHoliday {
  date: string;
  name: string;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  expenseId?: string;
  /** Which scheduled due date this payment covers. */
  dueDate?: string;
  categoryId: string;
  description: string;
  source: 'manual' | 'auto';
  /** Monotonically increasing sequence number for stable sort within same day. */
  seq?: number;
}

export interface OverdueHold {
  expenseId: string;
  expenseName: string;
  amount: number;
  originalDueDate: string;
  deferCount: number;
  categoryId: string;
}

export interface Goal {
  id: string;
  name: string;
  type: 'target' | 'continuous';
  status: 'active' | 'paused';
  /** Daily contribution rate (cadence is display-only). */
  contributionRatePerDay: number;
  cadence: 'weekly' | 'biweekly' | 'monthly';
  targetAmount?: number;
  targetDate?: string;
  accumulatedTotal: number;
  /** Optional date for automatic un-pause. */
  autoUnpauseDate?: string;
}

export interface DfmSegment {
  startDay: number;
  endDay: number;
  rate: number;
  pinchDate: string;
  nextRate: number | null; // rate after this pinch clears (null if final segment)
}

export interface DfmResult {
  dailyFreeMoney: number;
  sustainableRate: number;
  /** Buffer-constrained max rate (no sustainable cap). Used as savings ceiling. */
  rawDfm: number;
  pinchPointDate: string;
  pinchPointBalance: number;
  projectedBalances: { date: string; balance: number; rawBalance: number; savings?: number }[];
  segments: DfmSegment[];
}

export interface BarSegment {
  label: string;
  amount: number;
  color: string;
  categoryId: string | null;
  type: 'obligation' | 'buffer' | 'free_money' | 'overdue_hold' | 'savings' | 'savings_inflow';
  funding?: {
    nextDue: number;
    nextDueDate: string;
    nextAllocated: number;
    futureTotal: number;
    futureAllocated: number;
  };
}

export interface BarBreakdown {
  segments: BarSegment[];
  totalBalance: number;
  /** Spendable-until-next-paycheck pool: conservative DFM × days to next income. */
  freeToSpend: number;
  nextIncomeDate: string | null;
}

export interface AppState {
  balance: Balance;
  buffer: number;
  categories: Category[];
  incomeSources: IncomeSource[];
  expenses: Expense[];
  customHolidays: CustomHoliday[];
  transactions: Transaction[];
  overdueHolds: OverdueHold[];
  subscriptionLog: { lastProcessedDate: string };
  /** Tracks the last day scheduled contributions were moved into the vault. */
  savingsLog?: { lastAccrualDate: string };
  nextSeq: number;
  goals: Goal[];
  /** One-time warning shown on the first deficit (tiers default to 2). */
  hasSeenDeficitWarning?: boolean;
}
