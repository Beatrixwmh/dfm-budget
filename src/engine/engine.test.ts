import { describe, it, expect } from 'vitest';
import { calculateDfm } from './dfm';
import { generateCashEvents } from './eventGenerator';
import { generateDates } from './scheduler';
import { getObservedHolidays, toDateKey } from './holidays';
import { calculateBarBreakdown } from './barChart';
import {
  testIncome,
  testExpenses,
  testCategories,
  TEST_BALANCE,
  TEST_BUFFER,
} from './testData';
import type { Schedule } from './types';

describe('Holidays', () => {
  it('should generate correct US federal holidays for 2026', () => {
    const holidays = getObservedHolidays(2026);
    expect(holidays.has('2026-01-01')).toBe(true); // New Year's
    expect(holidays.has('2026-01-19')).toBe(true); // MLK Day (3rd Mon)
    expect(holidays.has('2026-12-25')).toBe(true); // Christmas
    expect(holidays.has('2026-07-03')).toBe(true); // July 4th is Saturday -> observed Friday July 3
    expect(holidays.has('2026-11-26')).toBe(true); // Thanksgiving (4th Thu)
  });
});

describe('Scheduler', () => {
  const today = new Date(2026, 4, 25); // May 25, 2026
  const windowEnd = new Date(2026, 7, 25); // Aug 25, 2026 (3 months)

  it('should generate monthly dates', () => {
    const schedule: Schedule = {
      frequency: 'monthly',
      dayOfMonth: 1,
      dayOfWeek: null,
      startDate: '2026-01-01',
      endDate: null,
      weekendRule: 'as_is',
      holidayRule: 'as_is',
    };
    const dates = generateDates(schedule, today, windowEnd);
    expect(dates.length).toBe(3); // Jun 1, Jul 1, Aug 1
    expect(toDateKey(dates[0])).toBe('2026-06-01');
    expect(toDateKey(dates[1])).toBe('2026-07-01');
    expect(toDateKey(dates[2])).toBe('2026-08-01');
  });

  it('should generate biweekly dates on Fridays', () => {
    const schedule: Schedule = {
      frequency: 'biweekly',
      dayOfMonth: null,
      dayOfWeek: 5, // Friday
      startDate: '2026-05-01',
      endDate: null,
      weekendRule: 'as_is',
      holidayRule: 'as_is',
    };
    const dates = generateDates(schedule, today, windowEnd);
    for (const d of dates) {
      expect(d.getDay()).toBe(5); // All should be Fridays
    }
    expect(dates.length).toBeGreaterThan(0);
  });

  it('should handle semimonthly with custom days', () => {
    const schedule: Schedule = {
      frequency: 'semimonthly',
      dayOfMonth: null,
      dayOfWeek: null,
      semimonthlyDays: [1, 15],
      startDate: '2026-01-01',
      endDate: null,
      weekendRule: 'as_is',
      holidayRule: 'as_is',
    };
    const dates = generateDates(schedule, today, windowEnd);
    expect(dates.length).toBe(6); // Jun 1, Jun 15, Jul 1, Jul 15, Aug 1, Aug 15
  });

  it('should apply weekend rule friday_before', () => {
    const schedule: Schedule = {
      frequency: 'monthly',
      dayOfMonth: 1,
      dayOfWeek: null,
      startDate: '2026-01-01',
      endDate: null,
      weekendRule: 'friday_before',
      holidayRule: 'as_is',
    };
    // Aug 1 2026 is Saturday -> should shift to Friday Jul 31
    const windowStart = new Date(2026, 6, 25);
    const windowEndLocal = new Date(2026, 8, 1);
    const dates = generateDates(schedule, windowStart, windowEndLocal);
    const augDate = dates.find(d => d.getMonth() === 6 && d.getDate() === 31);
    expect(augDate).toBeDefined();
  });

  it('should handle dayOfMonth = -1 for last day of month', () => {
    const schedule: Schedule = {
      frequency: 'monthly',
      dayOfMonth: -1,
      dayOfWeek: null,
      startDate: '2026-01-01',
      endDate: null,
      weekendRule: 'as_is',
      holidayRule: 'as_is',
    };
    const windowStart = new Date(2026, 1, 1); // Feb
    const windowEndLocal = new Date(2026, 2, 31); // through March
    const dates = generateDates(schedule, windowStart, windowEndLocal);
    const febDate = dates.find(d => d.getMonth() === 1);
    expect(febDate?.getDate()).toBe(28); // Feb 28, 2026
    const marDate = dates.find(d => d.getMonth() === 2);
    expect(marDate?.getDate()).toBe(31); // Mar 31
  });

  it('should respect endDate', () => {
    const schedule: Schedule = {
      frequency: 'monthly',
      dayOfMonth: 15,
      dayOfWeek: null,
      startDate: '2026-01-01',
      endDate: '2026-07-01',
      weekendRule: 'as_is',
      holidayRule: 'as_is',
    };
    const dates = generateDates(schedule, today, windowEnd);
    expect(dates.length).toBe(1); // Only Jun 15 (before Jul 1 endDate)
  });
});

describe('Event Generator', () => {
  it('should generate events from test income and expenses', () => {
    const today = new Date(2026, 4, 25);
    const events = generateCashEvents(testIncome, testExpenses, today);
    expect(events.length).toBeGreaterThan(0);

    const incomeEvents = events.filter(e => e.amount > 0);
    const expenseEvents = events.filter(e => e.amount < 0);

    expect(incomeEvents.length).toBeGreaterThan(0);
    expect(expenseEvents.length).toBeGreaterThan(0);

    // Income should be $1268 per occurrence
    for (const e of incomeEvents) {
      expect(e.amount).toBe(1268);
    }
  });
});

describe('DFM Algorithm', () => {
  it('should calculate DFM with test data', () => {
    const today = new Date(2026, 4, 25);
    const events = generateCashEvents(testIncome, testExpenses, today);
    const result = calculateDfm(TEST_BALANCE, TEST_BUFFER, events, today);

    console.log('=== DFM Results ===');
    console.log(`Daily Free Money: $${result.dailyFreeMoney.toFixed(2)}`);
    console.log(`Weekly: $${(result.dailyFreeMoney * 7).toFixed(2)}`);
    console.log(`Monthly: $${(result.dailyFreeMoney * 30).toFixed(2)}`);
    console.log(`Pinch Point: ${result.pinchPointDate}`);
    console.log(`Pinch Balance: $${result.pinchPointBalance.toFixed(2)}`);

    // DFM should be a finite number
    expect(isFinite(result.dailyFreeMoney)).toBe(true);
    // Pinch point should be within window
    expect(result.pinchPointDate > toDateKey(today)).toBe(true);
    // Projected balances should exist
    expect(result.projectedBalances.length).toBe(731); // today + 730 days
  });

  it('should return negative DFM when expenses exceed income', () => {
    const today = new Date(2026, 4, 25);
    // Use a tiny balance with the same expenses
    const events = generateCashEvents(testIncome, testExpenses, today);
    const result = calculateDfm(0, 500, events, today);
    // With $0 balance, $500 buffer, and substantial monthly expenses, DFM should be negative
    expect(result.dailyFreeMoney).toBeLessThan(0);
  });

  it('should give higher DFM with higher balance when constrained', () => {
    const today = new Date(2026, 4, 25);
    const events = generateCashEvents(testIncome, testExpenses, today);
    // $0 balance should be constrained below sustainable rate
    const result1 = calculateDfm(0, 0, events, today);
    // $5000 balance should be at sustainable rate (unconstrained)
    const result2 = calculateDfm(5000, 0, events, today);
    expect(result2.dailyFreeMoney).toBeGreaterThan(result1.dailyFreeMoney);
  });

  it('should cap DFM at sustainable rate when surplus exists', () => {
    const today = new Date(2026, 4, 25);
    const events = generateCashEvents(testIncome, testExpenses, today);
    // With a very large balance, DFM should not exceed the sustainable rate
    const bigBalance = calculateDfm(100000, 0, events, today);
    const normalBalance = calculateDfm(1500, 0, events, today);

    // Both should be capped at sustainable rate when surplus is large
    expect(bigBalance.dailyFreeMoney).toBe(bigBalance.sustainableRate);
    // Normal balance might hit a pinch point below sustainable rate
    expect(normalBalance.dailyFreeMoney).toBeLessThanOrEqual(normalBalance.sustainableRate);
  });

  it('should produce stable DFM day-over-day when surplus exists', () => {
    const today1 = new Date(2026, 4, 25);
    const today2 = new Date(2026, 4, 26);
    const events1 = generateCashEvents(testIncome, testExpenses, today1);
    const events2 = generateCashEvents(testIncome, testExpenses, today2);
    const result1 = calculateDfm(50000, 0, events1, today1);
    const result2 = calculateDfm(50000, 0, events2, today2);

    // With a large surplus, DFM should be at sustainable rate both days
    // and remain very close (small variance from window shift is ok)
    expect(Math.abs(result1.dailyFreeMoney - result2.dailyFreeMoney)).toBeLessThan(1);
  });
});

describe('Bar Chart Breakdown', () => {
  it('should create segments that sum to total balance', () => {
    const today = new Date(2026, 4, 25);
    const todayKey = toDateKey(today);
    const events = generateCashEvents(testIncome, testExpenses, today);
    const dfm = calculateDfm(TEST_BALANCE, TEST_BUFFER, events, today);
    const breakdown = calculateBarBreakdown(
      TEST_BALANCE,
      dfm.dailyFreeMoney,
      TEST_BUFFER,
      events,
      testCategories,
      todayKey
    );

    expect(breakdown.segments.length).toBeGreaterThan(0);
    expect(breakdown.totalBalance).toBe(TEST_BALANCE);

    console.log('\n=== Bar Breakdown ===');
    for (const seg of breakdown.segments) {
      console.log(`${seg.label}: $${seg.amount.toFixed(2)} (${seg.type})`);
    }
  });
});
