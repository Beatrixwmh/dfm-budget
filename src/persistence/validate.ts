import type { AppState, Expense } from '../engine/types';

function migrateExpense(e: unknown): Expense {
  const exp = e as Record<string, unknown>;
  return {
    id: exp.id as string,
    name: exp.name as string,
    amount: exp.amount as number,
    categoryId: (exp.categoryId as string) ?? '',
    type: (exp.type as Expense['type']) ?? 'recurring',
    isVariable: (exp.isVariable as boolean) ?? false,
    schedule: (exp.schedule as Expense['schedule']) ?? null,
    tier: typeof exp.tier === 'number' ? (exp.tier as Expense['tier']) : 2,
    isAutoCut: (exp.isAutoCut as boolean) ?? false,
    ...(exp.targetAmount !== undefined && { targetAmount: exp.targetAmount as number }),
    ...(exp.targetDate !== undefined && { targetDate: exp.targetDate as string }),
    ...(exp.currentSaved !== undefined && { currentSaved: exp.currentSaved as number }),
    ...(exp.savingsMode !== undefined && { savingsMode: exp.savingsMode as Expense['savingsMode'] }),
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

  return {
    balance: {
      currentBalance: balance.currentBalance,
      lastUpdated: typeof balance.lastUpdated === 'string' ? balance.lastUpdated : new Date().toISOString().slice(0, 10),
    },
    buffer: typeof obj.buffer === 'number' ? obj.buffer : 0,
    categories: Array.isArray(obj.categories) ? obj.categories : [],
    incomeSources: Array.isArray(obj.incomeSources) ? obj.incomeSources : [],
    expenses: rawExpenses.map(migrateExpense),
    customHolidays: Array.isArray(obj.customHolidays) ? obj.customHolidays : [],
    transactions: Array.isArray(obj.transactions) ? obj.transactions : [],
    overdueHolds: Array.isArray(obj.overdueHolds) ? obj.overdueHolds : [],
    subscriptionLog: obj.subscriptionLog && typeof (obj.subscriptionLog as Record<string, unknown>).lastProcessedDate === 'string'
      ? obj.subscriptionLog as { lastProcessedDate: string }
      : { lastProcessedDate: '' },
  };
}
