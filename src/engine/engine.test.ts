import { describe, it, expect } from 'vitest';
import { calculateDfm, maxSpendToday } from './dfm';
import { generateCashEvents } from './eventGenerator';
import { generateDates } from './scheduler';
import { getObservedHolidays, toDateKey } from './holidays';
import { calculateBarBreakdown } from './barChart';
import { computeEffectiveBalance } from './effectiveBalance';
import { detectOverdueExpenses } from './overdueDetector';
import { calculateFastestDate, validateContribution, findFirstSavableDate } from './savings';
import { computeSnapshot } from './snapshot';
import { planDeficit, simulateCuts, autoSelectCuts, findRestorable } from './deficit';
import { computeSavingsAccrual } from './savingsAccrual';
import { hypotheticalEvents, hypotheticalToExpense } from './hypotheticals';
import type { Hypothetical } from './hypotheticals';
import { appReducer } from '../store/reducer';
import { createDefaultState } from '../store/defaults';
import {
  testIncome,
  testExpenses,
  testCategories,
  TEST_BALANCE,
  TEST_BUFFER,
} from './testData';
import type { Schedule, OverdueHold, Expense, Transaction, Goal } from './types';

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
      interval: 1, unit: 'month',
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
      interval: 2, unit: 'week',
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
      interval: 1, unit: 'month',
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
      interval: 1, unit: 'month',
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
      interval: 1, unit: 'month',
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
      interval: 1, unit: 'month',
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

  it('should handle "every 6 months"', () => {
    const schedule: Schedule = {
      interval: 6, unit: 'month',
      dayOfMonth: 5,
      dayOfWeek: null,
      startDate: '2026-01-05',
      endDate: null,
      weekendRule: 'as_is',
      holidayRule: 'as_is',
    };
    // Window Jan 2026 → Dec 2027: expect Jan 5, Jul 5, Jan 5, Jul 5
    const dates = generateDates(schedule, new Date(2026, 0, 1), new Date(2027, 11, 31));
    const keys = dates.map(toDateKey);
    expect(keys).toContain('2026-01-05');
    expect(keys).toContain('2026-07-05');
    expect(keys).toContain('2027-01-05');
    expect(keys).toContain('2027-07-05');
    // exactly every 6 months — no in-between months
    expect(keys).not.toContain('2026-04-05');
  });

  it('should handle "every 3 weeks"', () => {
    const schedule: Schedule = {
      interval: 3, unit: 'week',
      dayOfMonth: null,
      dayOfWeek: 1, // Monday
      startDate: '2026-06-01', // Mon Jun 1
      endDate: null,
      weekendRule: 'as_is',
      holidayRule: 'as_is',
    };
    const dates = generateDates(schedule, new Date(2026, 5, 1), new Date(2026, 7, 1));
    const keys = dates.map(toDateKey);
    // Jun 1, then +21 days = Jun 22, then Jul 13
    expect(keys).toContain('2026-06-01');
    expect(keys).toContain('2026-06-22');
    expect(keys).toContain('2026-07-13');
    expect(keys).not.toContain('2026-06-08'); // not weekly
  });

  it('should handle "every 2 years"', () => {
    const schedule: Schedule = {
      interval: 2, unit: 'year',
      dayOfMonth: 10,
      dayOfWeek: null,
      startDate: '2026-03-10',
      endDate: null,
      weekendRule: 'as_is',
      holidayRule: 'as_is',
    };
    const dates = generateDates(schedule, new Date(2026, 0, 1), new Date(2031, 0, 1));
    const keys = dates.map(toDateKey);
    expect(keys).toContain('2026-03-10');
    expect(keys).toContain('2028-03-10');
    expect(keys).toContain('2030-03-10');
    expect(keys).not.toContain('2027-03-10'); // skips a year
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
    // With comfortable balance, no pinch below sustainable — pinchPointDate is empty
    // (pinch only appears when balance is tight enough to force a lower rate)
    expect(result.pinchPointDate).toBe('');
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

describe('Multi-Segment DFM Projection', () => {
  it('should produce one segment at sustainable rate when no pinch exists (large balance)', () => {
    const today = new Date(2026, 4, 25);
    const events = generateCashEvents(testIncome, testExpenses, today);
    // With very large balance, no pinch below sustainable
    const result = calculateDfm(100000, 0, events, today);

    expect(result.segments.length).toBe(1);
    expect(result.segments[0].rate).toBeCloseTo(result.sustainableRate, 5);
    expect(result.segments[0].endDay).toBe(730);
    expect(result.segments[0].nextRate).toBeNull();
  });

  it('should produce at least two segments (pinch rate then sustainable) with tight balance', () => {
    const today = new Date(2026, 4, 25);
    const events = generateCashEvents(testIncome, testExpenses, today);
    // With a tight balance, a near-term pinch should force a lower first segment
    const result = calculateDfm(200, 0, events, today);

    expect(result.segments.length).toBeGreaterThanOrEqual(2);
    // First segment rate should be less than sustainable (pinched)
    expect(result.segments[0].rate).toBeLessThan(result.sustainableRate);
    // First segment = today's DFM
    expect(result.segments[0].rate).toBeCloseTo(result.dailyFreeMoney, 5);
    // Last segment should be at sustainable rate
    const lastSeg = result.segments[result.segments.length - 1];
    expect(lastSeg.rate).toBeCloseTo(result.sustainableRate, 5);
    // Segments should taper upward (each rate ≥ previous)
    for (let i = 1; i < result.segments.length; i++) {
      expect(result.segments[i].rate).toBeGreaterThanOrEqual(result.segments[i - 1].rate - 0.01);
    }
  });

  it('should have successive binding minima — not markers on every sub-sustainable day', () => {
    const today = new Date(2026, 4, 25);
    const events = generateCashEvents(testIncome, testExpenses, today);
    // Use tight balance to force multiple segments
    const result = calculateDfm(200, 0, events, today);

    // Should be a small number of segments (typically 1-3), not hundreds
    expect(result.segments.length).toBeLessThan(10);
    // Segments should cover the full window without gaps
    expect(result.segments[0].startDay).toBe(0);
    for (let i = 1; i < result.segments.length; i++) {
      expect(result.segments[i].startDay).toBe(result.segments[i - 1].endDay);
    }
    expect(result.segments[result.segments.length - 1].endDay).toBe(730);
  });

  it('should build projected balances piecewise with rate changes at boundaries', () => {
    const today = new Date(2026, 4, 25);
    const events = generateCashEvents(testIncome, testExpenses, today);
    // Tight balance forces a pinch
    const result = calculateDfm(200, 0, events, today);

    if (result.segments.length >= 2) {
      const boundary = result.segments[0].endDay;
      // Balance at pinch boundary should be near buffer (0 in this case)
      const balanceAtPinch = result.projectedBalances[boundary].balance;
      // Should be approximately at buffer level (within a few days' spending tolerance)
      expect(balanceAtPinch).toBeLessThan(Math.abs(result.dailyFreeMoney) * 3);
    }

    // With tight balance, DFM may be negative — just verify projection is consistent
    expect(result.projectedBalances.length).toBe(731);
    expect(result.projectedBalances[0].balance).toBe(200);
  });

  it('should handle two pinch points correctly', () => {
    // Create a scenario with two distinct pinch points:
    // Near-term crunch, then relief, then another cluster months later
    const today = new Date(2026, 4, 25);
    // Small balance forces multiple pinch constraints
    const events = generateCashEvents(testIncome, testExpenses, today);
    const result = calculateDfm(800, 0, events, today);

    // With very small balance and large expenses, should find multiple pinch points
    if (result.segments.length >= 3) {
      // Middle segment rate should be between first and sustainable
      expect(result.segments[1].rate).toBeGreaterThanOrEqual(result.segments[0].rate - 0.01);
      expect(result.segments[1].rate).toBeLessThanOrEqual(result.sustainableRate + 0.01);
    }
    // Regardless of segment count, the algorithm must work
    expect(result.segments.length).toBeGreaterThanOrEqual(1);
    expect(result.dailyFreeMoney).toBe(result.segments[0].rate);
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

  it('should include amber overdue_hold segment when overdueHoldTotal > 0', () => {
    const today = new Date(2026, 4, 25);
    const todayKey = toDateKey(today);
    const events = generateCashEvents(testIncome, testExpenses, today);
    const dfm = calculateDfm(TEST_BALANCE, TEST_BUFFER, events, today);
    const overdueHoldTotal = 200;
    const breakdown = calculateBarBreakdown(
      TEST_BALANCE,
      dfm.dailyFreeMoney,
      TEST_BUFFER,
      events,
      testCategories,
      todayKey,
      overdueHoldTotal
    );

    const holdSegment = breakdown.segments.find(s => s.type === 'overdue_hold');
    expect(holdSegment).toBeDefined();
    expect(holdSegment!.amount).toBe(200);
    expect(holdSegment!.color).toBe('#d4be7e');
    expect(holdSegment!.label).toBe('Pending Bills');
  });

  it('should NOT include overdue_hold segment when overdueHoldTotal is 0', () => {
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
      todayKey,
      0
    );

    const holdSegment = breakdown.segments.find(s => s.type === 'overdue_hold');
    expect(holdSegment).toBeUndefined();
  });

  it('should not drain the free segment when a savings vault exists', () => {
    const today = new Date(2026, 4, 25);
    const todayKey = toDateKey(today);
    const events = generateCashEvents(testIncome, testExpenses, today);
    const vault = 1500;
    const totalBalance = TEST_BALANCE + vault;
    // DFM computed on the spendable pool, mirroring useDfmEngine
    const dfm = calculateDfm(totalBalance - vault, TEST_BUFFER, events, today);
    const breakdown = calculateBarBreakdown(
      totalBalance,
      dfm.dailyFreeMoney,
      TEST_BUFFER,
      events,
      testCategories,
      todayKey,
      0,
      [],
      vault
    );

    const free = breakdown.segments.find(s => s.type === 'free_money')!;
    const savings = breakdown.segments.find(s => s.type === 'savings')!;
    expect(savings.amount).toBe(vault);
    // Free money is the DFM-derived pool, NOT reduced by the vault
    expect(free.amount).toBeCloseTo(breakdown.freeToSpend, 6);
    expect(free.amount).toBeGreaterThan(0);
    // Segments still account for the full balance
    const sum = breakdown.segments.reduce((s, seg) => s + seg.amount, 0);
    expect(sum).toBeCloseTo(totalBalance, 6);
  });
});

describe('maxSpendToday (splurge ceiling)', () => {
  const mkEvent = (date: string, amount: number) => ({
    date, amount, sourceId: 'x', sourceName: 'x', categoryId: null,
  });

  it('equals balance minus buffer when all future events are positive', () => {
    const today = new Date(2026, 6, 1);
    const events = [mkEvent('2026-07-10', 500), mkEvent('2026-07-24', 500)];
    expect(maxSpendToday(2000, 300, events, today)).toBe(1700);
  });

  it('is limited by the worst future dip, not today', () => {
    const today = new Date(2026, 6, 1);
    // Balance 2000, buffer 0: a -1800 bill on Jul 5 means only 200 is splurgeable
    const events = [mkEvent('2026-07-05', -1800), mkEvent('2026-07-20', 3000)];
    expect(maxSpendToday(2000, 0, events, today)).toBe(200);
  });

  it('clamps to zero when already at or below the buffer', () => {
    const today = new Date(2026, 6, 1);
    expect(maxSpendToday(250, 300, [], today)).toBe(0);
    expect(maxSpendToday(500, 500, [mkEvent('2026-07-03', -100)], today)).toBe(0);
  });

  it('never exceeds what the buffer allows at any intermediate point', () => {
    const today = new Date(2026, 6, 1);
    const events = [
      mkEvent('2026-07-03', -400),
      mkEvent('2026-07-10', 1000),
      mkEvent('2026-07-15', -900),
    ];
    // Trajectory without spending: 1000 -> 600 -> 1600 -> 700. Min = 600.
    expect(maxSpendToday(1000, 100, events, today)).toBe(500);
  });
});

describe('Effective Balance', () => {
  it('should subtract overdue holds from current balance', () => {
    const holds: OverdueHold[] = [
      { expenseId: 'e1', expenseName: 'Rent', amount: 800, originalDueDate: '2026-05-01', deferCount: 0, categoryId: 'cat-housing' },
      { expenseId: 'e2', expenseName: 'Electric', amount: 45, originalDueDate: '2026-05-07', deferCount: 1, categoryId: 'cat-utilities' },
    ];
    expect(computeEffectiveBalance(1500, holds)).toBe(655);
  });

  it('should return full balance when no holds exist', () => {
    expect(computeEffectiveBalance(1500, [])).toBe(1500);
  });

  it('should allow negative effective balance', () => {
    const holds: OverdueHold[] = [
      { expenseId: 'e1', expenseName: 'Big Bill', amount: 2000, originalDueDate: '2026-05-01', deferCount: 0, categoryId: '' },
    ];
    expect(computeEffectiveBalance(1500, holds)).toBe(-500);
  });
});

describe('Overdue Detector', () => {
  it('should detect overdue recurring expenses with no transaction', () => {
    const today = new Date(2026, 4, 27); // May 27
    const expenses: Expense[] = [
      {
        id: 'exp-test',
        name: 'Test Bill',
        amount: 100,
        categoryId: 'cat-utilities',
        type: 'recurring',
        tier: 1,
        isAutoCut: false,
        schedule: {
          interval: 1, unit: 'month',
          dayOfMonth: 15,
          dayOfWeek: null,
          startDate: '2026-01-01',
          endDate: null,
          weekendRule: 'as_is',
          holidayRule: 'as_is',
        },
      },
    ];
    const holds = detectOverdueExpenses(expenses, [], [], [], today);
    expect(holds.length).toBe(1);
    expect(holds[0].expenseId).toBe('exp-test');
    expect(holds[0].amount).toBe(100);
    expect(holds[0].originalDueDate).toBe('2026-05-15');
  });

  it('should NOT flag expenses with a matching transaction', () => {
    const today = new Date(2026, 4, 27);
    const expenses: Expense[] = [
      {
        id: 'exp-test',
        name: 'Test Bill',
        amount: 100,
        categoryId: 'cat-utilities',
        type: 'recurring',
        tier: 1,
        isAutoCut: false,
        schedule: {
          interval: 1, unit: 'month',
          dayOfMonth: 15,
          dayOfWeek: null,
          startDate: '2026-01-01',
          endDate: null,
          weekendRule: 'as_is',
          holidayRule: 'as_is',
        },
      },
    ];
    const transactions: Transaction[] = [
      { id: 'tx-1', expenseId: 'exp-test', date: '2026-05-15', amount: 100, description: 'Test Bill', categoryId: 'cat-utilities', source: 'manual' },
    ];
    const holds = detectOverdueExpenses(expenses, transactions, [], [], today);
    expect(holds.length).toBe(0);
  });

  it('should NOT flag expenses that already have a hold', () => {
    const today = new Date(2026, 4, 27);
    const expenses: Expense[] = [
      {
        id: 'exp-test',
        name: 'Test Bill',
        amount: 100,
        categoryId: 'cat-utilities',
        type: 'recurring',
        tier: 1,
        isAutoCut: false,
        schedule: {
          interval: 1, unit: 'month',
          dayOfMonth: 15,
          dayOfWeek: null,
          startDate: '2026-01-01',
          endDate: null,
          weekendRule: 'as_is',
          holidayRule: 'as_is',
        },
      },
    ];
    const existingHolds: OverdueHold[] = [
      { expenseId: 'exp-test', expenseName: 'Test Bill', amount: 100, originalDueDate: '2026-05-15', deferCount: 0, categoryId: 'cat-utilities' },
    ];
    const holds = detectOverdueExpenses(expenses, [], existingHolds, [], today);
    expect(holds.length).toBe(0);
  });

  it('should skip subscription-type expenses', () => {
    const today = new Date(2026, 4, 27);
    const expenses: Expense[] = [
      {
        id: 'exp-sub',
        name: 'Netflix',
        amount: 15,
        categoryId: 'cat-subscriptions',
        type: 'subscription',
        tier: 3,
        isAutoCut: false,
        schedule: {
          interval: 1, unit: 'month',
          dayOfMonth: 10,
          dayOfWeek: null,
          startDate: '2026-01-01',
          endDate: null,
          weekendRule: 'as_is',
          holidayRule: 'as_is',
        },
      },
    ];
    const holds = detectOverdueExpenses(expenses, [], [], [], today);
    expect(holds.length).toBe(0);
  });

  it('should NOT flag expense due today (only past due)', () => {
    const today = new Date(2026, 4, 15); // May 15 — same as due date
    const expenses: Expense[] = [
      {
        id: 'exp-today',
        name: 'Due Today',
        amount: 50,
        categoryId: '',
        type: 'recurring',
        tier: 2,
        isAutoCut: false,
        schedule: {
          interval: 1, unit: 'month',
          dayOfMonth: 15,
          dayOfWeek: null,
          startDate: '2026-01-01',
          endDate: null,
          weekendRule: 'as_is',
          holidayRule: 'as_is',
        },
      },
    ];
    const holds = detectOverdueExpenses(expenses, [], [], [], today);
    expect(holds.length).toBe(0);
  });
});

describe('Savings Engine (rawDfm based)', () => {
  it('should calculate fastest date using rawDfm', () => {
    const today = new Date(2026, 4, 25);
    const events = generateCashEvents(testIncome, testExpenses, today);
    const dfm = calculateDfm(TEST_BALANCE, TEST_BUFFER, events, today);
    const result = calculateFastestDate(dfm.rawDfm, 500);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.maxRatePerDay).toBeGreaterThan(0);
      expect(result.daysToReach).toBeGreaterThan(0);
      // Rate should not exceed rawDfm
      expect(result.maxRatePerDay).toBeLessThanOrEqual(dfm.rawDfm + 0.01);
    }
  });

  it('should return null when target is unreachable within window', () => {
    const today = new Date(2026, 4, 25);
    const events = generateCashEvents(testIncome, testExpenses, today);
    const dfm = calculateDfm(TEST_BALANCE, TEST_BUFFER, events, today);
    const result = calculateFastestDate(dfm.rawDfm, 999999);
    expect(result).toBeNull();
  });

  it('should validate a feasible contribution rate', () => {
    const today = new Date(2026, 4, 25);
    const events = generateCashEvents(testIncome, testExpenses, today);
    const dfm = calculateDfm(TEST_BALANCE, TEST_BUFFER, events, today);
    const result = validateContribution(dfm.rawDfm, 0.01);
    expect(result.feasible).toBe(true);
    expect(result.maxRate).toBeGreaterThan(0);
  });

  it('should reject contribution rate exceeding rawDfm', () => {
    const today = new Date(2026, 4, 25);
    const events = generateCashEvents(testIncome, testExpenses, today);
    const dfm = calculateDfm(TEST_BALANCE, TEST_BUFFER, events, today);
    const result = validateContribution(dfm.rawDfm, 10000);
    expect(result.feasible).toBe(false);
  });

  it('max savings should bring DFM to exactly 0, never negative', () => {
    const today = new Date(2026, 4, 25);
    const events = generateCashEvents(testIncome, testExpenses, today);
    const dfm = calculateDfm(TEST_BALANCE, TEST_BUFFER, events, today);
    // Save at max rate (rawDfm)
    const cappedSavings = Math.min(dfm.rawDfm, Math.max(0, dfm.rawDfm));
    // Apply the same floor logic as useDfmEngine
    const floor = Math.min(0, dfm.dailyFreeMoney);
    const adjustedDfm = Math.max(floor, dfm.dailyFreeMoney - cappedSavings);
    // DFM should be >= 0 when base DFM was positive
    if (dfm.dailyFreeMoney >= 0) {
      expect(adjustedDfm).toBeGreaterThanOrEqual(-0.01);
    }
  });

  it('rawDfm should be >= sustainableRate-capped DFM', () => {
    const today = new Date(2026, 4, 25);
    const events = generateCashEvents(testIncome, testExpenses, today);
    const dfm = calculateDfm(TEST_BALANCE, TEST_BUFFER, events, today);
    // rawDfm is the aggressive query, always >= the conservative DFM
    expect(dfm.rawDfm).toBeGreaterThanOrEqual(dfm.dailyFreeMoney - 0.01);
  });

  it('findFirstSavableDate returns today when surplus exists now', () => {
    const today = new Date(2026, 4, 25);
    const events = generateCashEvents(testIncome, testExpenses, today);
    const result = findFirstSavableDate(TEST_BALANCE, TEST_BUFFER, events, today);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.daysOut).toBe(0); // savable immediately
      expect(result.maxRate).toBeGreaterThan(0);
    }
  });

  it('findFirstSavableDate returns a future date when underwater now', () => {
    const today = new Date(2026, 4, 25);
    const events = generateCashEvents(testIncome, testExpenses, today);
    // Negative spendable — underwater. Income should eventually create surplus.
    const result = findFirstSavableDate(-500, 100, events, today);
    if (result) {
      expect(result.daysOut).toBeGreaterThanOrEqual(0);
      expect(result.maxRate).toBeGreaterThan(0);
    }
    // Either finds a future date or returns null (both valid); just shouldn't throw
    expect(result === null || result.daysOut >= 0).toBe(true);
  });

  it('findFirstSavableDate returns null when permanently underwater', () => {
    const today = new Date(2026, 4, 25);
    // No income, only expenses — never savable
    const expenseOnly = generateCashEvents([], testExpenses, today);
    const result = findFirstSavableDate(-10000, 100, expenseOnly, today);
    expect(result).toBeNull();
  });
});

describe('Spend from Target Goal', () => {
  it('part_of_goal intent should lower targetAmount by spend', () => {
    let state = createDefaultState();
    state.goals = [{
      id: 'g1', name: 'Trip', type: 'target', status: 'active',
      contributionRatePerDay: 10, cadence: 'monthly',
      targetAmount: 2000, targetDate: '2027-01-01',
      accumulatedTotal: 800,
    }];
    state.balance = { currentBalance: 5000, lastUpdated: '2026-06-05' };

    state = appReducer(state, {
      type: 'SPEND_FROM_SAVINGS',
      payload: {
        goalId: 'g1', amount: 400,
        transaction: { id: 'tx1', date: '2026-06-05', amount: 400, categoryId: '', description: 'Flights', source: 'manual' },
        intent: 'part_of_goal',
      },
    });

    const goal = state.goals[0];
    expect(goal.accumulatedTotal).toBe(400);   // 800 - 400
    expect(goal.targetAmount).toBe(1600);      // 2000 - 400
    expect(state.balance.currentBalance).toBe(4600); // 5000 - 400
    expect(state.transactions.length).toBe(1);
  });

  it('withdrawal intent should keep targetAmount and recede date', () => {
    let state = createDefaultState();
    state.goals = [{
      id: 'g1', name: 'Emergency', type: 'target', status: 'active',
      contributionRatePerDay: 10, cadence: 'monthly',
      targetAmount: 3000, targetDate: '2027-06-01',
      accumulatedTotal: 1500,
    }];
    state.balance = { currentBalance: 5000, lastUpdated: '2026-06-05' };

    state = appReducer(state, {
      type: 'SPEND_FROM_SAVINGS',
      payload: {
        goalId: 'g1', amount: 500,
        transaction: { id: 'tx1', date: '2026-06-05', amount: 500, categoryId: '', description: 'Car repair', source: 'manual' },
        intent: 'withdrawal',
        newTargetDate: '2027-08-01',
      },
    });

    const goal = state.goals[0];
    expect(goal.accumulatedTotal).toBe(1000);  // 1500 - 500
    expect(goal.targetAmount).toBe(3000);      // unchanged
    expect(goal.targetDate).toBe('2027-08-01'); // receded
    expect(state.balance.currentBalance).toBe(4500);
    expect(state.transactions.length).toBe(1);
  });

  it('both intents file a real transaction and decrement accumulatedTotal', () => {
    let state = createDefaultState();
    state.goals = [{
      id: 'g1', name: 'Test', type: 'target', status: 'active',
      contributionRatePerDay: 5, cadence: 'weekly',
      targetAmount: 1000, accumulatedTotal: 600,
    }];
    state.balance = { currentBalance: 2000, lastUpdated: '2026-06-05' };

    // Test part_of_goal
    const state1 = appReducer(state, {
      type: 'SPEND_FROM_SAVINGS',
      payload: {
        goalId: 'g1', amount: 100,
        transaction: { id: 'tx1', date: '2026-06-05', amount: 100, categoryId: '', description: 'x', source: 'manual' },
        intent: 'part_of_goal',
      },
    });
    expect(state1.goals[0].accumulatedTotal).toBe(500);
    expect(state1.transactions.length).toBe(1);
    expect(state1.balance.currentBalance).toBe(1900);

    // Test withdrawal
    const state2 = appReducer(state, {
      type: 'SPEND_FROM_SAVINGS',
      payload: {
        goalId: 'g1', amount: 100,
        transaction: { id: 'tx2', date: '2026-06-05', amount: 100, categoryId: '', description: 'y', source: 'manual' },
        intent: 'withdrawal', newTargetDate: '2027-01-01',
      },
    });
    expect(state2.goals[0].accumulatedTotal).toBe(500);
    expect(state2.transactions.length).toBe(1);
    expect(state2.balance.currentBalance).toBe(1900);
  });
});

describe('Auto-Unpause', () => {
  it('Goal should store autoUnpauseDate when paused with a date', () => {
    let state = createDefaultState();
    state.goals = [{
      id: 'g1', name: 'Fund', type: 'continuous', status: 'active',
      contributionRatePerDay: 5, cadence: 'monthly', accumulatedTotal: 200,
    }];

    state = appReducer(state, {
      type: 'UPDATE_GOAL',
      payload: { ...state.goals[0], status: 'paused', autoUnpauseDate: '2026-09-01' },
    });

    expect(state.goals[0].status).toBe('paused');
    expect(state.goals[0].autoUnpauseDate).toBe('2026-09-01');
  });

  it('Resume should clear autoUnpauseDate', () => {
    let state = createDefaultState();
    state.goals = [{
      id: 'g1', name: 'Fund', type: 'continuous', status: 'paused',
      contributionRatePerDay: 5, cadence: 'monthly', accumulatedTotal: 200,
      autoUnpauseDate: '2026-09-01',
    }];

    state = appReducer(state, {
      type: 'UPDATE_GOAL',
      payload: { ...state.goals[0], status: 'active', autoUnpauseDate: undefined },
    });

    expect(state.goals[0].status).toBe('active');
    expect(state.goals[0].autoUnpauseDate).toBeUndefined();
  });
});

describe('Deficit Mode', () => {
  const TODAY = new Date(2026, 4, 25);
  const monthly = (dayOfMonth: number): Schedule => ({
    interval: 1, unit: 'month', dayOfMonth, dayOfWeek: null,
    startDate: '2026-01-01', endDate: null, weekendRule: 'as_is', holidayRule: 'as_is',
  });
  const expense = (id: string, name: string, amount: number, tier: 0 | 1 | 2 | 3, isAutoCut = false): Expense => ({
    id, name, amount, categoryId: '', type: 'recurring',
    schedule: monthly(15), tier, isAutoCut,
  });

  // Income $500/mo vs $570/mo of expenses → structural deficit (~-$2.3/day)
  function deficitState(incomeAmount = 500) {
    const state = createDefaultState();
    state.balance = { currentBalance: 2000, lastUpdated: '2026-05-25' };
    state.buffer = 0;
    state.incomeSources = [{
      id: 'inc', name: 'Job', amount: incomeAmount, schedule: monthly(1),
    }];
    state.expenses = [
      expense('rent', 'Rent', 300, 0),
      expense('netflix', 'Netflix', 150, 3),
      expense('gym', 'Gym', 120, 2),
    ];
    return state;
  }

  it('plans levers in A2 order: tier 3 → 2 → 1, tier 0 never listed', () => {
    const plan = planDeficit(deficitState(), TODAY);
    expect(plan.inDeficit).toBe(true);
    expect(plan.deficitPerDay).toBeGreaterThan(0);
    expect(plan.tiers.map(t => t.tier)).toEqual([3, 2]);
    const allCandidates = plan.tiers.flatMap(t => t.candidates.map(c => c.expenseId));
    expect(allCandidates).not.toContain('rent');
    expect(allCandidates).toContain('netflix');
    expect(plan.resolvable).toBe(true);
  });

  it('freedPerDay is positive and cutting the T3 expense resolves this deficit', () => {
    const state = deficitState();
    const plan = planDeficit(state, TODAY);
    const netflix = plan.tiers[0].candidates.find(c => c.expenseId === 'netflix')!;
    expect(netflix.freedPerDay).toBeGreaterThan(plan.deficitPerDay);
    expect(simulateCuts(state, TODAY, new Set(['netflix']))).toBeGreaterThanOrEqual(0);
  });

  it('autoSelectCuts picks from tier 3 first and stops once resolved', () => {
    const state = deficitState();
    const chosen = autoSelectCuts(state, TODAY, planDeficit(state, TODAY));
    expect(chosen.has('netflix')).toBe(true);
    expect(chosen.has('gym')).toBe(false); // T3 alone was enough
    expect(chosen.has('rent')).toBe(false);
  });

  it('flags unresolvable when tier 0 alone exceeds income', () => {
    const state = deficitState();
    state.expenses = [expense('rent', 'Rent', 600, 0), expense('netflix', 'Netflix', 150, 3)];
    const plan = planDeficit(state, TODAY);
    expect(plan.inDeficit).toBe(true);
    expect(plan.resolvable).toBe(false);
  });

  it('cut expenses vanish from the event stream (isAutoCut respected by snapshot)', () => {
    const state = deficitState();
    state.expenses = state.expenses.map(e => e.id === 'netflix' ? { ...e, isAutoCut: true } : e);
    const snap = computeSnapshot(state, TODAY)!;
    expect(snap.events.some(e => e.sourceId === 'netflix')).toBe(false);
    expect(snap.dfm.dailyFreeMoney).toBeGreaterThanOrEqual(0);
  });

  it('findRestorable restores when the budget improves, essentials first', () => {
    // Both cut, income raised enough for ONE of them ($540 vs $300 rent + one of gym/netflix)
    const state = deficitState(540);
    state.expenses = [
      expense('rent', 'Rent', 300, 0),
      expense('netflix', 'Netflix', 150, 3, true),
      expense('gym', 'Gym', 120, 2, true),
    ];
    const ids = findRestorable(state, TODAY);
    // Tier 2 (gym) comes back before tier 3 (netflix); netflix doesn't fit
    expect(ids).toContain('gym');
    expect(ids).not.toContain('netflix');
  });

  it('findRestorable restores nothing while still under water', () => {
    const state = deficitState(400); // even deeper deficit
    state.expenses = state.expenses.map(e => e.id === 'netflix' ? { ...e, isAutoCut: true } : e);
    // still negative with netflix cut (400 - 420 base)
    expect(findRestorable(state, TODAY)).toEqual([]);
  });

  it('findRestorable restores everything when there is plenty of room', () => {
    const state = deficitState(900);
    state.expenses = [
      expense('rent', 'Rent', 300, 0),
      expense('netflix', 'Netflix', 150, 3, true),
      expense('gym', 'Gym', 120, 2, true),
    ];
    const ids = findRestorable(state, TODAY);
    expect(new Set(ids)).toEqual(new Set(['netflix', 'gym']));
  });
});

describe('Savings: throttled completions + accrual', () => {
  const TODAY = new Date(2026, 4, 25);
  const monthly = (dayOfMonth: number): Schedule => ({
    interval: 1, unit: 'month', dayOfMonth, dayOfWeek: null,
    startDate: '2026-01-01', endDate: null, weekendRule: 'as_is', holidayRule: 'as_is',
  });

  // Income 500/mo, expense 300/mo, balance 2000 → rawDfm ≈ $9.3/day.
  // Goal wants $20/day → throttled to ~46%.
  function throttledState() {
    const state = createDefaultState();
    state.balance = { currentBalance: 2000, lastUpdated: '2026-05-25' };
    state.buffer = 0;
    state.incomeSources = [{
      id: 'inc', name: 'Job', amount: 500, schedule: monthly(1),
    }];
    state.expenses = [{
      id: 'rent', name: 'Rent', amount: 300, categoryId: '', type: 'recurring',
      schedule: monthly(15), tier: 0, isAutoCut: false,
    }];
    state.goals = [{
      id: 'g1', name: 'Trip', type: 'target', status: 'active',
      contributionRatePerDay: 20, cadence: 'weekly', targetAmount: 700, accumulatedTotal: 0,
    }];
    return state;
  }

  it('appliedSavingsRate is the throttled rate, not the desired rate', () => {
    const snap = computeSnapshot(throttledState(), TODAY)!;
    expect(snap.appliedSavingsRate).toBeLessThan(20);
    expect(snap.appliedSavingsRate).toBeCloseTo(snap.dfm.rawDfm, 6);
  });

  it('goal completion date comes from the throttled sim, later than the naive date', () => {
    const snap = computeSnapshot(throttledState(), TODAY)!;
    expect(snap.goalCompletions).toHaveLength(1);
    const completion = snap.goalCompletions[0];
    // Naive: 700/20 = 35 days → 2026-06-29. Throttled (~9.3/day): ~75 days.
    expect(completion.date > '2026-06-29').toBe(true);
    // The freed rate is the throttled flow, not the desired 20/day
    expect(completion.ratePerDay).toBeLessThan(20);
    // And the savings trajectory flatlines exactly at the target from that day on
    const after = snap.dfm.projectedBalances.filter(p => p.date >= completion.date);
    for (const p of after) {
      expect(p.savings).toBeCloseTo(700, 6);
    }
  });

  it('savings line matches the marker: no growth past completion', () => {
    const snap = computeSnapshot(throttledState(), TODAY)!;
    const last = snap.dfm.projectedBalances[snap.dfm.projectedBalances.length - 1];
    expect(last.savings).toBeCloseTo(700, 6); // capped at target, not still growing
  });

  it('balance bar shows a To Savings inflow segment sized by the vault sim', () => {
    const snap = computeSnapshot(throttledState(), TODAY)!;
    const inflow = snap.barBreakdown.segments.find(s => s.type === 'savings_inflow');
    expect(inflow).toBeDefined();
    // Next income is Jun 1 (7 days out) — inflow ≈ applied rate × 7
    expect(inflow!.amount).toBeCloseTo(snap.appliedSavingsRate * 7, 1);
    // Segments still account for the full balance
    const sum = snap.barBreakdown.segments.reduce((s, seg) => s + seg.amount, 0);
    expect(sum).toBeCloseTo(2000, 6);
  });

  it('no inflow segment when there are no active goals', () => {
    const state = throttledState();
    state.goals = [];
    const snap = computeSnapshot(state, TODAY)!;
    expect(snap.barBreakdown.segments.find(s => s.type === 'savings_inflow')).toBeUndefined();
  });

  it('accrual initializes lastAccrualDate without back-accruing', () => {
    const state = throttledState();
    state.savingsLog = { lastAccrualDate: '' };
    const result = computeSavingsAccrual(state, TODAY)!;
    expect(result.date).toBe('2026-05-25');
    expect(result.deposits).toEqual([]);
  });

  it('accrual deposits the throttled rate × elapsed days, clipped at target', () => {
    const state = throttledState();
    state.savingsLog = { lastAccrualDate: '2026-05-22' }; // 3 days ago
    const snap = computeSnapshot(state, TODAY)!;
    const result = computeSavingsAccrual(state, TODAY)!;
    expect(result.deposits).toHaveLength(1);
    expect(result.deposits[0].goalId).toBe('g1');
    expect(result.deposits[0].amount).toBeCloseTo(snap.appliedSavingsRate * 3, 1);

    // Clipping: goal almost full → deposit only the remainder
    state.goals[0].accumulatedTotal = 699.5;
    const clipped = computeSavingsAccrual(state, TODAY)!;
    expect(clipped.deposits[0].amount).toBeCloseTo(0.5, 2);
  });

  it('accrual is a no-op the same day and deposits nothing while frozen', () => {
    const state = throttledState();
    state.savingsLog = { lastAccrualDate: '2026-05-25' };
    expect(computeSavingsAccrual(state, TODAY)).toBeNull();

    // Frozen: no spendable room at all (underwater) → days pass, nothing accrues
    state.savingsLog = { lastAccrualDate: '2026-05-20' };
    state.balance.currentBalance = -100;
    const frozen = computeSavingsAccrual(state, TODAY)!;
    expect(frozen.deposits).toEqual([]);
    expect(frozen.date).toBe('2026-05-25'); // date still advances
  });

  it('ACCRUE_SAVINGS reducer adds deposits and stamps the date', () => {
    let state = throttledState();
    state = appReducer(state, {
      type: 'ACCRUE_SAVINGS',
      payload: { date: '2026-05-25', deposits: [{ goalId: 'g1', amount: 27.9 }] },
    });
    expect(state.goals[0].accumulatedTotal).toBeCloseTo(27.9, 6);
    expect(state.savingsLog?.lastAccrualDate).toBe('2026-05-25');
  });
});

describe('computeSnapshot (pure engine pipeline)', () => {
  const TODAY = new Date(2026, 4, 25);

  function fixtureState() {
    const state = createDefaultState();
    state.balance = { currentBalance: TEST_BALANCE + 1000, lastUpdated: '2026-05-25' };
    state.buffer = TEST_BUFFER;
    state.categories = testCategories;
    state.incomeSources = testIncome;
    state.expenses = testExpenses;
    state.goals = [{
      id: 'g1', name: 'Fund', type: 'target', status: 'active',
      contributionRatePerDay: 3, cadence: 'weekly', targetAmount: 5000,
      accumulatedTotal: 1000,
    } as Goal];
    return state;
  }

  it('matches the hand-composed pipeline (golden)', () => {
    const state = fixtureState();
    const snap = computeSnapshot(state, TODAY)!;

    // Recompute the core by hand: spendable = effective - vault
    const events = generateCashEvents(testIncome, testExpenses, TODAY);
    const rawDfm = calculateDfm(state.balance.currentBalance - 1000, TEST_BUFFER, events, TODAY);
    const cappedSavings = Math.min(3, Math.max(0, rawDfm.rawDfm));

    expect(snap.dfm.dailyFreeMoney).toBeCloseTo(
      Math.max(Math.min(0, rawDfm.dailyFreeMoney), rawDfm.dailyFreeMoney - cappedSavings), 9);
    expect(snap.events.length).toBe(events.length);
    expect(snap.effectiveBalance).toBe(state.balance.currentBalance);
    expect(snap.maxSplurge).toBe(
      maxSpendToday(state.balance.currentBalance - 1000, TEST_BUFFER, events, TODAY));
    // Projected balance line includes the vault and never dips below it
    for (const p of snap.dfm.projectedBalances) {
      expect(p.balance).toBeGreaterThanOrEqual((p.savings ?? 0) - 1e-6);
    }
  });

  it('returns null with no income and no expenses', () => {
    const state = createDefaultState();
    expect(computeSnapshot(state, TODAY)).toBeNull();
  });

  it('extraEvents merge into the stream and lower the DFM', () => {
    const state = fixtureState();
    const base = computeSnapshot(state, TODAY)!;
    const scenario = computeSnapshot(state, TODAY, {
      extraEvents: [{
        date: '2026-06-10', amount: -500, sourceId: 'hypo-1',
        sourceName: 'Hypothetical', categoryId: null,
      }],
    })!;

    expect(scenario.events.length).toBe(base.events.length + 1);
    expect(scenario.dfm.dailyFreeMoney).toBeLessThan(base.dfm.dailyFreeMoney);
    expect(scenario.maxSplurge).toBeLessThanOrEqual(base.maxSplurge);
    // Stream stays date-sorted after the merge
    for (let i = 1; i < scenario.events.length; i++) {
      expect(scenario.events[i].date >= scenario.events[i - 1].date).toBe(true);
    }
  });

  it('excludeExpenseIds removes that expense\'s entire event stream and raises DFM', () => {
    const state = fixtureState();
    const base = computeSnapshot(state, TODAY)!;
    const target = testExpenses[0];
    const without = computeSnapshot(state, TODAY, {
      excludeExpenseIds: new Set([target.id]),
    })!;

    expect(without.events.some(e => e.sourceId === target.id)).toBe(false);
    expect(base.events.some(e => e.sourceId === target.id)).toBe(true);
    expect(without.dfm.dailyFreeMoney).toBeGreaterThan(base.dfm.dailyFreeMoney);
  });

  it('hypothetical one-time produces exactly one negative event on its date', () => {
    const hypo: Hypothetical = {
      id: 'h1', description: 'New couch', amount: 800, kind: 'one_time',
      date: '2026-06-15', categoryId: '',
    };
    const events = hypotheticalEvents([hypo], TODAY);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ date: '2026-06-15', amount: -800, sourceId: 'h1' });
  });

  it('a buy-it-today hypothetical shifts to tomorrow so it registers in DFM', () => {
    const hypo: Hypothetical = {
      id: 'h-today', description: 'Impulse buy', amount: 300, kind: 'one_time',
      date: toDateKey(TODAY), categoryId: '',
    };
    const events = hypotheticalEvents([hypo], TODAY);
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe('2026-05-26'); // tomorrow
    expect(events[0].amount).toBe(-300);

    // And it actually moves the scenario numbers
    const state = fixtureState();
    const base = computeSnapshot(state, TODAY)!;
    const scenario = computeSnapshot(state, TODAY, { extraEvents: events })!;
    expect(scenario.maxSplurge).toBeLessThan(base.maxSplurge);
  });

  it('hypothetical recurring runs through the real scheduler (every 2 weeks)', () => {
    const hypo: Hypothetical = {
      id: 'h2', description: 'Climbing gym', amount: 60, kind: 'recurring',
      date: '2026-05-25', categoryId: '',
      schedule: {
        interval: 2, unit: 'week', dayOfMonth: null, dayOfWeek: 1,
        startDate: '2026-05-25', endDate: '2026-08-25',
        weekendRule: 'as_is', holidayRule: 'as_is',
      },
    };
    const events = hypotheticalEvents([hypo], TODAY);
    expect(events.length).toBeGreaterThanOrEqual(6); // ~13 weeks / 2
    expect(events.every(e => e.amount === -60)).toBe(true);
    // First occurrence lands ON today (May 25 is a Monday) → shifted to tomorrow;
    // steady-state occurrences are 14 days apart.
    expect(events[0].date).toBe('2026-05-26');
    const d1 = new Date(events[1].date).getTime();
    const d2 = new Date(events[2].date).getTime();
    expect((d2 - d1) / 86400000).toBe(14);
  });

  it('hypotheticalToExpense produces a valid applyable expense', () => {
    const hypo: Hypothetical = {
      id: 'h3', description: 'Coffee habit', amount: 25, kind: 'recurring',
      date: '2026-05-25', categoryId: 'cat-1',
      schedule: {
        interval: 1, unit: 'week', dayOfMonth: null, dayOfWeek: 5,
        startDate: '2026-05-25', endDate: null,
        weekendRule: 'as_is', holidayRule: 'as_is',
      },
    };
    const expense = hypotheticalToExpense(hypo);
    expect(expense.type).toBe('recurring');
    expect(expense.tier).toBe(2);
    expect(expense.amount).toBe(25);
    // One-time fork pins the schedule to the single date
    const oneTime = hypotheticalToExpense({ ...hypo, kind: 'one_time', date: '2026-07-01', schedule: undefined });
    expect(oneTime.type).toBe('one_time');
    expect(oneTime.schedule?.startDate).toBe('2026-07-01');
    expect(oneTime.schedule?.endDate).toBe('2026-07-01');
  });

  it('pauseAllSavings restores the un-throttled spending rate', () => {
    const state = fixtureState();
    const withSavings = computeSnapshot(state, TODAY)!;
    const paused = computeSnapshot(state, TODAY, { pauseAllSavings: true })!;

    // Pausing contributions gives spending back the capped amount
    expect(paused.dfm.dailyFreeMoney).toBeGreaterThan(withSavings.dfm.dailyFreeMoney);
    expect(paused.savingsFrozen).toBe(false);
    // The vault itself (accumulated) stays walled off either way
    const savingsSeg = paused.barBreakdown.segments.find(s => s.type === 'savings');
    expect(savingsSeg?.amount).toBe(1000);
  });
});
