import type { AppState } from '../engine/types';
import { todayString } from '../utils/format';

export function createDefaultState(): AppState {
  return {
    balance: { currentBalance: 0, lastUpdated: todayString() },
    buffer: 0,
    categories: [],
    incomeSources: [],
    expenses: [],
    customHolidays: [],
    transactions: [],
    overdueHolds: [],
    subscriptionLog: { lastProcessedDate: '' },
    savingsLog: { lastAccrualDate: '' },
    nextSeq: 1,
    goals: [],
  };
}
