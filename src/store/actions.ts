import type { AppState, Category, IncomeSource, Expense, CustomHoliday, Transaction, OverdueHold } from '../engine/types';

export type AppAction =
  | { type: 'SET_BALANCE'; payload: { currentBalance: number; lastUpdated: string } }
  | { type: 'SET_BUFFER'; payload: number }
  | { type: 'ADD_CATEGORY'; payload: Category }
  | { type: 'UPDATE_CATEGORY'; payload: Category }
  | { type: 'DELETE_CATEGORY'; payload: string }
  | { type: 'REORDER_CATEGORIES'; payload: Category[] }
  | { type: 'ADD_INCOME'; payload: IncomeSource }
  | { type: 'UPDATE_INCOME'; payload: IncomeSource }
  | { type: 'DELETE_INCOME'; payload: string }
  | { type: 'ADD_EXPENSE'; payload: Expense }
  | { type: 'UPDATE_EXPENSE'; payload: Expense }
  | { type: 'DELETE_EXPENSE'; payload: string }
  | { type: 'ADD_HOLIDAY'; payload: CustomHoliday }
  | { type: 'DELETE_HOLIDAY'; payload: string }
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'ADD_OVERDUE_HOLD'; payload: OverdueHold }
  | { type: 'DEFER_OVERDUE_HOLD'; payload: string }
  | { type: 'DISMISS_OVERDUE'; payload: string }
  | { type: 'PAY_OVERDUE'; payload: { expenseId: string; actualAmount: number; transaction: Transaction } }
  | { type: 'PAY_EXPENSE'; payload: { actualAmount: number; transaction: Transaction } }
  | { type: 'QUICK_ADD_EXPENSE'; payload: { amount: number; transaction: Transaction } }
  | { type: 'SET_SUBSCRIPTION_LOG'; payload: { lastProcessedDate: string } }
  | { type: 'IMPORT_STATE'; payload: AppState };
