import type { CashEvent, Category, BarSegment, BarBreakdown, Transaction } from './types';

interface ExpenseObligation {
  sourceId: string;
  sourceName: string;
  categoryId: string | null;
  nextDue: number;
  nextDueDate: string;
  futureTotal: number; // sum of all occurrences beyond the next one
}

export function calculateBarBreakdown(
  currentBalance: number,
  dailyFreeMoney: number,
  buffer: number,
  events: CashEvent[],
  categories: Category[],
  today: string,
  overdueHoldTotal: number = 0,
  transactions: Transaction[] = [],
  savingsTotal: number = 0
): BarBreakdown {
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  const nextIncomeDate = findNextIncomeDate(events, today);
  const daysToNextIncome = nextIncomeDate
    ? Math.max(1, daysBetween(today, nextIncomeDate))
    : 30;

  const freeMoney = Math.max(0, dailyFreeMoney * daysToNextIncome);

  // Build a map of expenseId → set of paid dueDates
  const paidOccurrences = new Map<string, Set<string>>();
  for (const tx of transactions) {
    if (tx.expenseId && tx.dueDate) {
      const set = paidOccurrences.get(tx.expenseId) ?? new Set();
      set.add(tx.dueDate);
      paidOccurrences.set(tx.expenseId, set);
    }
  }

  // Collect ALL unpaid future occurrences per expense
  const expenseMap = new Map<string, ExpenseObligation>();

  for (const event of events) {
    if (event.amount >= 0) continue;
    if (event.date <= today) continue;

    // Skip paid occurrences
    const paidDates = paidOccurrences.get(event.sourceId);
    if (paidDates && paidDates.has(event.date)) continue;

    const due = Math.abs(event.amount);
    const existing = expenseMap.get(event.sourceId);

    if (!existing) {
      // First unpaid occurrence = the "next" one
      expenseMap.set(event.sourceId, {
        sourceId: event.sourceId,
        sourceName: event.sourceName,
        categoryId: event.categoryId,
        nextDue: due,
        nextDueDate: event.date,
        futureTotal: 0,
      });
    } else {
      // Subsequent occurrences go into futureTotal
      existing.futureTotal += due;
    }
  }

  // Calculate total obligations across all expenses (next + future)
  const obligations = [...expenseMap.values()];
  const grandTotal = obligations.reduce((s, o) => s + o.nextDue + o.futureTotal, 0);

  // Available money for obligations = SPENDABLE balance (vault excluded) minus
  // buffer, free money, and overdue holds. The vault gets its own segment below —
  // counting it here would inflate obligations and drain the free segment.
  const availableForObligations = Math.max(
    0,
    currentBalance - savingsTotal - freeMoney - buffer - overdueHoldTotal
  );

  // Distribute available money proportionally across expenses
  const segments: BarSegment[] = [];

  for (const ob of obligations) {
    const totalObligation = ob.nextDue + ob.futureTotal;
    const share = grandTotal > 0
      ? (totalObligation / grandTotal) * availableForObligations
      : 0;

    // Split the share: fund next occurrence first, remainder goes to future
    const nextAllocated = Math.min(ob.nextDue, share);
    const futureAllocated = Math.max(0, share - nextAllocated);

    const cat = ob.categoryId ? categoryMap.get(ob.categoryId) : null;

    segments.push({
      label: ob.sourceName,
      amount: share,
      color: cat?.color ?? '#6b7280',
      categoryId: ob.categoryId,
      type: 'obligation',
      funding: {
        nextDue: ob.nextDue,
        nextDueDate: ob.nextDueDate,
        nextAllocated,
        futureTotal: ob.futureTotal,
        futureAllocated,
      },
    });
  }

  segments.sort((a, b) => b.amount - a.amount);

  if (buffer > 0) {
    segments.push({
      label: 'Safety Buffer',
      amount: buffer,
      color: '#e0b074',
      categoryId: null,
      type: 'buffer',
    });
  }

  if (overdueHoldTotal > 0) {
    segments.push({
      label: 'Pending Bills',
      amount: overdueHoldTotal,
      color: '#d4be7e',
      categoryId: null,
      type: 'overdue_hold',
    });
  }

  if (savingsTotal > 0) {
    segments.push({
      label: 'Savings',
      amount: savingsTotal,
      color: '#6fb3ac',
      categoryId: null,
      type: 'savings',
    });
  }

  segments.push({
    label: 'Free Money',
    amount: freeMoney,
    color: '#6dbf9c',
    categoryId: null,
    type: 'free_money',
  });

  return { segments, totalBalance: currentBalance, freeToSpend: freeMoney, nextIncomeDate };
}

function findNextIncomeDate(events: CashEvent[], today: string): string | null {
  for (const event of events) {
    if (event.amount > 0 && event.date > today) return event.date;
  }
  return null;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = new Date(ay, am - 1, ad);
  const db = new Date(by, bm - 1, bd);
  return Math.round((db.getTime() - da.getTime()) / (86400 * 1000));
}
