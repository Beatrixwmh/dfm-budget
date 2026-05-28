import type { CashEvent } from '../../engine/types';

export type Timescale = '7d' | '30d' | '90d' | '6mo' | '1yr' | '2yr';

export interface CashFlowItem {
  name: string;
  amount: number;
}

export interface CashFlowBucket {
  label: string;
  income: number;
  expenses: number;
  net: number;
  incomeItems: CashFlowItem[];
  expenseItems: CashFlowItem[];
}

interface TimescaleConfig {
  days: number;
  bucketBy: 'day' | 'week' | 'month';
}

const TIMESCALE_CONFIGS: Record<Timescale, TimescaleConfig> = {
  '7d': { days: 7, bucketBy: 'day' },
  '30d': { days: 30, bucketBy: 'day' },
  '90d': { days: 90, bucketBy: 'week' },
  '6mo': { days: 182, bucketBy: 'week' },
  '1yr': { days: 365, bucketBy: 'month' },
  '2yr': { days: 730, bucketBy: 'month' },
};

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function aggregateEvents(
  events: CashEvent[],
  timescale: Timescale,
  today: string
): CashFlowBucket[] {
  const config = TIMESCALE_CONFIGS[timescale];
  const todayDate = new Date(today);
  const endDate = new Date(todayDate);
  endDate.setDate(endDate.getDate() + config.days);
  const endKey = toKey(endDate);

  const filtered = events.filter(e => e.date > today && e.date <= endKey);

  if (config.bucketBy === 'day') {
    return bucketByDay(filtered, todayDate, config.days, timescale);
  } else if (config.bucketBy === 'week') {
    return bucketByWeek(filtered, todayDate, config.days);
  } else {
    return bucketByMonth(filtered, todayDate, config.days, timescale);
  }
}

function bucketByDay(events: CashEvent[], start: Date, days: number, timescale: Timescale): CashFlowBucket[] {
  const buckets: CashFlowBucket[] = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = toKey(d);
    const label = timescale === '7d'
      ? SHORT_DAYS[d.getDay()]
      : `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
    let income = 0, expenses = 0;
    const incomeItems: CashFlowItem[] = [];
    const expenseItems: CashFlowItem[] = [];
    for (const e of events) {
      if (e.date === key) {
        if (e.amount > 0) {
          income += e.amount;
          incomeItems.push({ name: e.sourceName, amount: e.amount });
        } else {
          expenses += e.amount;
          expenseItems.push({ name: e.sourceName, amount: e.amount });
        }
      }
    }
    buckets.push({ label, income, expenses, net: income + expenses, incomeItems, expenseItems });
  }
  return buckets;
}

function bucketByWeek(events: CashEvent[], start: Date, days: number): CashFlowBucket[] {
  const buckets: CashFlowBucket[] = [];
  const weeks = Math.ceil(days / 7);
  for (let w = 0; w < weeks; w++) {
    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() + w * 7 + 1);
    const weekEnd = new Date(start);
    weekEnd.setDate(weekEnd.getDate() + (w + 1) * 7);
    const startKey = toKey(weekStart);
    const endKey = toKey(weekEnd);
    const label = `${SHORT_MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}`;
    let income = 0, expenses = 0;
    const incomeItems: CashFlowItem[] = [];
    const expenseItems: CashFlowItem[] = [];
    for (const e of events) {
      if (e.date >= startKey && e.date <= endKey) {
        if (e.amount > 0) {
          income += e.amount;
          incomeItems.push({ name: e.sourceName, amount: e.amount });
        } else {
          expenses += e.amount;
          expenseItems.push({ name: e.sourceName, amount: e.amount });
        }
      }
    }
    buckets.push({ label, income, expenses, net: income + expenses, incomeItems, expenseItems });
  }
  return buckets;
}

function bucketByMonth(events: CashEvent[], start: Date, days: number, timescale: Timescale): CashFlowBucket[] {
  const buckets: CashFlowBucket[] = [];
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  let cursor = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  while (cursor <= end) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const startKey = toKey(cursor);
    const endKey = toKey(monthEnd);
    const label = timescale === '2yr'
      ? `${SHORT_MONTHS[cursor.getMonth()]} '${String(cursor.getFullYear()).slice(2)}`
      : SHORT_MONTHS[cursor.getMonth()];
    let income = 0, expenses = 0;
    const incomeItems: CashFlowItem[] = [];
    const expenseItems: CashFlowItem[] = [];
    for (const e of events) {
      if (e.date >= startKey && e.date <= endKey) {
        if (e.amount > 0) {
          income += e.amount;
          incomeItems.push({ name: e.sourceName, amount: e.amount });
        } else {
          expenses += e.amount;
          expenseItems.push({ name: e.sourceName, amount: e.amount });
        }
      }
    }
    buckets.push({ label, income, expenses, net: income + expenses, incomeItems, expenseItems });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return buckets;
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
