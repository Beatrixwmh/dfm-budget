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
  frequency: ScheduleFrequency;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  semimonthlyDays?: [number, number];
  startDate: string;
  endDate: string | null;
  weekendRule: WeekendRule;
  holidayRule: HolidayRule;
}

export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  isVariable: boolean;
  schedule: Schedule;
}

export type ExpenseType = 'recurring' | 'one_time' | 'subscription' | 'savings_goal';

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
  isVariable: boolean;
  schedule: Schedule | null;
  tier: ExpenseTier;
  isAutoCut: boolean;
  targetAmount?: number;
  targetDate?: string;
  currentSaved?: number;
  savingsMode?: 'target_date' | 'fixed_contribution';
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
  categoryId: string;
  description: string;
  source: 'manual' | 'auto';
}

export interface OverdueHold {
  expenseId: string;
  expenseName: string;
  amount: number;
  originalDueDate: string;
  deferCount: number;
  categoryId: string;
}

export interface DfmHistoryEntry {
  date: string;
  dfm: number;
}

export interface DfmResult {
  dailyFreeMoney: number;
  sustainableRate: number;
  pinchPointDate: string;
  pinchPointBalance: number;
  projectedBalances: { date: string; balance: number; rawBalance: number }[];
}

export interface BarSegment {
  label: string;
  amount: number;
  color: string;
  categoryId: string | null;
  type: 'obligation' | 'future_reserves' | 'buffer' | 'free_money' | 'overdue_hold';
  funding?: {
    allocated: number;
    due: number;
    dueDate: string;
    expenseNames: string[];
  };
}

export interface BarBreakdown {
  segments: BarSegment[];
  totalBalance: number;
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
  dfmHistory: DfmHistoryEntry[];
  subscriptionLog: { lastProcessedDate: string };
}
