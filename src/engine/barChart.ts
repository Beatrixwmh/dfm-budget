import type { CashEvent, Category, BarSegment, BarBreakdown } from './types';

export function calculateBarBreakdown(
  currentBalance: number,
  dailyFreeMoney: number,
  buffer: number,
  events: CashEvent[],
  categories: Category[],
  today: string,
  overdueHoldTotal: number = 0
): BarBreakdown {
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  const nextIncomeDate = findNextIncomeDate(events, today);
  const daysToNextIncome = nextIncomeDate
    ? Math.max(1, daysBetween(today, nextIncomeDate))
    : 30;

  const freeMoney = Math.max(0, dailyFreeMoney * daysToNextIncome);
  const totalAllocated = currentBalance - freeMoney - buffer;

  const expensesByCategory = new Map<string, {
    due: number;
    allocated: number;
    dueDate: string;
    names: string[];
  }>();

  const seen = new Set<string>();
  for (const event of events) {
    if (event.amount >= 0) continue;
    if (event.date <= today) continue;
    if (seen.has(event.sourceId)) continue;
    seen.add(event.sourceId);

    const due = Math.abs(event.amount);
    const daysTillDue = Math.max(1, daysBetween(today, event.date));
    const allocated = Math.min(due, (due / daysTillDue) * daysToNextIncome);

    const catId = event.categoryId ?? '__uncategorized__';
    const existing = expensesByCategory.get(catId);
    if (existing) {
      existing.due += due;
      existing.allocated += allocated;
      if (!existing.names.includes(event.sourceName)) {
        existing.names.push(event.sourceName);
      }
      if (event.date < existing.dueDate) {
        existing.dueDate = event.date;
      }
    } else {
      expensesByCategory.set(catId, {
        due,
        allocated,
        dueDate: event.date,
        names: [event.sourceName],
      });
    }
  }

  let totalNamedAllocations = 0;
  const segments: BarSegment[] = [];

  for (const [catId, data] of expensesByCategory) {
    const cat = categoryMap.get(catId);
    segments.push({
      label: cat?.name ?? data.names.join(', '),
      amount: data.allocated,
      color: cat?.color ?? '#6b7280',
      categoryId: catId === '__uncategorized__' ? null : catId,
      type: 'obligation',
      funding: {
        allocated: data.allocated,
        due: data.due,
        dueDate: data.dueDate,
        expenseNames: data.names,
      },
    });
    totalNamedAllocations += data.allocated;
  }

  segments.sort((a, b) => b.amount - a.amount);

  const futureReserves = Math.max(0, totalAllocated - totalNamedAllocations);
  if (futureReserves > 0) {
    segments.push({
      label: 'Future Reserves',
      amount: futureReserves,
      color: '#94a3b8',
      categoryId: null,
      type: 'future_reserves',
    });
  }

  if (buffer > 0) {
    segments.push({
      label: 'Safety Buffer',
      amount: buffer,
      color: '#f59e0b',
      categoryId: null,
      type: 'buffer',
    });
  }

  if (overdueHoldTotal > 0) {
    segments.push({
      label: 'Pending Bills',
      amount: overdueHoldTotal,
      color: '#fbbf24',
      categoryId: null,
      type: 'overdue_hold',
    });
  }

  segments.push({
    label: 'Free Money',
    amount: freeMoney,
    color: '#22c55e',
    categoryId: null,
    type: 'free_money',
  });

  return { segments, totalBalance: currentBalance };
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
