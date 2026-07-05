import type { AppState, Expense, Schedule, ScheduleUnit, IncomeSource } from '../engine/types';

const FREQ_MAP: Record<string, { interval: number; unit: ScheduleUnit }> = {
  weekly: { interval: 1, unit: 'week' },
  biweekly: { interval: 2, unit: 'week' },
  monthly: { interval: 1, unit: 'month' },
  quarterly: { interval: 3, unit: 'month' },
  annual: { interval: 1, unit: 'year' },
  semimonthly: { interval: 1, unit: 'month' },
};

/** Convert a legacy `frequency`-based schedule to the new interval + unit model. */
function migrateSchedule(s: unknown): Schedule | null {
  if (!s || typeof s !== 'object') return null;
  const sch = s as Record<string, unknown>;

  // Already the new model — pass through.
  if (typeof sch.unit === 'string' && typeof sch.interval === 'number') {
    return sch as unknown as Schedule;
  }

  const freq = (sch.frequency as string) ?? 'monthly';
  const mapped = FREQ_MAP[freq] ?? { interval: 1, unit: 'month' as ScheduleUnit };
  const semimonthlyDays = freq === 'semimonthly'
    ? ((sch.semimonthlyDays as [number, number]) ?? [1, 15])
    : (sch.semimonthlyDays as [number, number] | undefined);

  return {
    interval: mapped.interval,
    unit: mapped.unit,
    dayOfMonth: (sch.dayOfMonth as number) ?? null,
    dayOfWeek: (sch.dayOfWeek as number) ?? null,
    ...(semimonthlyDays ? { semimonthlyDays } : {}),
    startDate: (sch.startDate as string) ?? new Date().toISOString().slice(0, 10),
    endDate: (sch.endDate as string) ?? null,
    weekendRule: (sch.weekendRule as Schedule['weekendRule']) ?? 'as_is',
    holidayRule: (sch.holidayRule as Schedule['holidayRule']) ?? 'as_is',
  };
}

function migrateExpense(e: unknown): Expense {
  const exp = e as Record<string, unknown>;
  // Migrate old savings_goal type to recurring
  const rawType = (exp.type as string) ?? 'recurring';
  const type = rawType === 'savings_goal' ? 'recurring' : rawType;
  return {
    id: exp.id as string,
    name: exp.name as string,
    amount: exp.amount as number,
    categoryId: (exp.categoryId as string) ?? '',
    type: type as Expense['type'],
    isVariable: (exp.isVariable as boolean) ?? false,
    schedule: migrateSchedule(exp.schedule),
    tier: typeof exp.tier === 'number' ? (exp.tier as Expense['tier']) : 2,
    isAutoCut: (exp.isAutoCut as boolean) ?? false,
  };
}

function migrateIncome(i: unknown): IncomeSource {
  const inc = i as Record<string, unknown>;
  return {
    id: inc.id as string,
    name: inc.name as string,
    amount: inc.amount as number,
    isVariable: (inc.isVariable as boolean) ?? false,
    schedule: migrateSchedule(inc.schedule) as Schedule,
  };
}

export function validateAppState(data: unknown): AppState {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid state: not an object');
  }

  const obj = data as Record<string, unknown>;

  const balance = obj.balance as Record<string, unknown> | undefined;
  if (!balance || typeof balance.currentBalance !== 'number') {
    throw new Error('Invalid state: missing or invalid balance');
  }

  const rawExpenses = Array.isArray(obj.expenses) ? obj.expenses : [];
  const rawIncome = Array.isArray(obj.incomeSources) ? obj.incomeSources : [];

  return {
    balance: {
      currentBalance: balance.currentBalance,
      lastUpdated: typeof balance.lastUpdated === 'string' ? balance.lastUpdated : new Date().toISOString().slice(0, 10),
    },
    buffer: typeof obj.buffer === 'number' ? obj.buffer : 0,
    categories: Array.isArray(obj.categories) ? obj.categories : [],
    incomeSources: rawIncome.map(migrateIncome),
    expenses: rawExpenses.map(migrateExpense),
    customHolidays: Array.isArray(obj.customHolidays) ? obj.customHolidays : [],
    transactions: Array.isArray(obj.transactions) ? obj.transactions : [],
    overdueHolds: Array.isArray(obj.overdueHolds) ? obj.overdueHolds : [],
    subscriptionLog: obj.subscriptionLog && typeof (obj.subscriptionLog as Record<string, unknown>).lastProcessedDate === 'string'
      ? obj.subscriptionLog as { lastProcessedDate: string }
      : { lastProcessedDate: '' },
    nextSeq: typeof obj.nextSeq === 'number' ? obj.nextSeq : (Array.isArray(obj.transactions) ? obj.transactions.length + 1 : 1),
    goals: Array.isArray(obj.goals) ? obj.goals : [],
    hasSeenDeficitWarning: obj.hasSeenDeficitWarning === true,
  };
}
