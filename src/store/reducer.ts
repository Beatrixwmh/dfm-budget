import type { AppState } from '../engine/types';
import type { AppAction } from './actions';

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_BALANCE':
      return { ...state, balance: action.payload };

    case 'SET_BUFFER':
      return { ...state, buffer: action.payload };

    case 'ADD_CATEGORY':
      return { ...state, categories: [...state.categories, action.payload] };

    case 'UPDATE_CATEGORY':
      return {
        ...state,
        categories: state.categories.map(c =>
          c.id === action.payload.id ? action.payload : c
        ),
      };

    case 'DELETE_CATEGORY':
      return {
        ...state,
        categories: state.categories.filter(c => c.id !== action.payload),
        expenses: state.expenses.map(e =>
          e.categoryId === action.payload ? { ...e, categoryId: '' } : e
        ),
      };

    case 'REORDER_CATEGORIES':
      return { ...state, categories: action.payload };

    case 'ADD_INCOME':
      return { ...state, incomeSources: [...state.incomeSources, action.payload] };

    case 'UPDATE_INCOME':
      return {
        ...state,
        incomeSources: state.incomeSources.map(i =>
          i.id === action.payload.id ? action.payload : i
        ),
      };

    case 'DELETE_INCOME':
      return {
        ...state,
        incomeSources: state.incomeSources.filter(i => i.id !== action.payload),
      };

    case 'ADD_EXPENSE':
      return { ...state, expenses: [...state.expenses, action.payload] };

    case 'UPDATE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.map(e =>
          e.id === action.payload.id ? action.payload : e
        ),
      };

    case 'DELETE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.filter(e => e.id !== action.payload),
      };

    case 'ADD_HOLIDAY':
      return { ...state, customHolidays: [...state.customHolidays, action.payload] };

    case 'DELETE_HOLIDAY':
      return {
        ...state,
        customHolidays: state.customHolidays.filter(h => h.date !== action.payload),
      };

    case 'ADD_TRANSACTION':
      return {
        ...state,
        transactions: [...state.transactions, { ...action.payload, seq: state.nextSeq }],
        nextSeq: state.nextSeq + 1,
      };

    case 'UPDATE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.map(t =>
          t.id === action.payload.id ? action.payload : t
        ),
      };

    case 'DELETE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.filter(t => t.id !== action.payload),
      };

    case 'ADD_OVERDUE_HOLD':
      return { ...state, overdueHolds: [...state.overdueHolds, action.payload] };

    case 'DEFER_OVERDUE_HOLD':
      return {
        ...state,
        overdueHolds: state.overdueHolds.map(h =>
          h.expenseId === action.payload ? { ...h, deferCount: h.deferCount + 1 } : h
        ),
      };

    case 'DISMISS_OVERDUE':
      return {
        ...state,
        overdueHolds: state.overdueHolds.filter(h => h.expenseId !== action.payload),
      };

    case 'PAY_OVERDUE': {
      const { expenseId, actualAmount, transaction } = action.payload;
      return {
        ...state,
        overdueHolds: state.overdueHolds.filter(h => h.expenseId !== expenseId),
        balance: {
          currentBalance: state.balance.currentBalance - actualAmount,
          lastUpdated: transaction.date,
        },
        transactions: [...state.transactions, { ...transaction, seq: state.nextSeq }],
        nextSeq: state.nextSeq + 1,
      };
    }

    case 'PAY_EXPENSE':
      return {
        ...state,
        balance: {
          currentBalance: state.balance.currentBalance - action.payload.actualAmount,
          lastUpdated: action.payload.transaction.date,
        },
        transactions: [...state.transactions, { ...action.payload.transaction, seq: state.nextSeq }],
        nextSeq: state.nextSeq + 1,
      };

    case 'QUICK_ADD_EXPENSE':
      return {
        ...state,
        balance: {
          currentBalance: state.balance.currentBalance - action.payload.amount,
          lastUpdated: action.payload.transaction.date,
        },
        transactions: [...state.transactions, { ...action.payload.transaction, seq: state.nextSeq }],
        nextSeq: state.nextSeq + 1,
      };

    case 'SPEND_FROM_SAVINGS': {
      const { goalId, amount, transaction, intent, newTargetDate } = action.payload;
      return {
        ...state,
        goals: state.goals.map(g => {
          if (g.id !== goalId) return g;
          const updated = { ...g, accumulatedTotal: Math.max(0, g.accumulatedTotal - amount) };
          if (intent === 'part_of_goal' && updated.targetAmount != null) {
            updated.targetAmount = Math.max(0, updated.targetAmount - amount);
          } else if (intent === 'withdrawal' && newTargetDate) {
            updated.targetDate = newTargetDate;
          }
          return updated;
        }),
        balance: {
          currentBalance: state.balance.currentBalance - amount,
          lastUpdated: transaction.date,
        },
        transactions: [...state.transactions, { ...transaction, seq: state.nextSeq }],
        nextSeq: state.nextSeq + 1,
      };
    }

    case 'SET_SUBSCRIPTION_LOG':
      return { ...state, subscriptionLog: action.payload };

    case 'ADD_GOAL':
      return { ...state, goals: [...state.goals, action.payload] };

    case 'UPDATE_GOAL':
      return {
        ...state,
        goals: state.goals.map(g => g.id === action.payload.id ? action.payload : g),
      };

    case 'DELETE_GOAL':
      return { ...state, goals: state.goals.filter(g => g.id !== action.payload) };

    case 'DEPOSIT_TO_GOAL':
      return {
        ...state,
        goals: state.goals.map(g =>
          g.id === action.payload.goalId
            ? { ...g, accumulatedTotal: g.accumulatedTotal + action.payload.amount }
            : g
        ),
      };

    case 'IMPORT_STATE':
      return action.payload;
  }
}
