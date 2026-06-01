import type { Schedule, CustomHoliday } from './types';
import { getObservedHolidays, isHoliday, isWeekend, toDateKey, addDays, parseDate } from './holidays';

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function applyHolidayRule(date: Date, rule: Schedule['holidayRule'], holidays: Set<string>): Date {
  if (rule === 'as_is') return date;
  let d = new Date(date);
  if (!isHoliday(d, holidays)) return d;

  if (rule === 'day_before') {
    while (isHoliday(d, holidays)) {
      d = addDays(d, -1);
    }
  } else if (rule === 'day_after') {
    while (isHoliday(d, holidays)) {
      d = addDays(d, 1);
    }
  } else if (rule === 'nearest_business_day') {
    let before = new Date(date);
    let after = new Date(date);
    let stepsBefore = 0;
    let stepsAfter = 0;
    while (isHoliday(before, holidays) || isWeekend(before)) {
      before = addDays(before, -1);
      stepsBefore++;
    }
    while (isHoliday(after, holidays) || isWeekend(after)) {
      after = addDays(after, 1);
      stepsAfter++;
    }
    d = stepsAfter <= stepsBefore ? after : before;
  }
  return d;
}

function applyWeekendRule(date: Date, rule: Schedule['weekendRule']): Date {
  if (rule === 'as_is') return date;
  let d = new Date(date);
  if (!isWeekend(d)) return d;

  if (rule === 'friday_before') {
    while (isWeekend(d)) {
      d = addDays(d, -1);
    }
  } else if (rule === 'monday_after') {
    while (isWeekend(d)) {
      d = addDays(d, 1);
    }
  } else if (rule === 'nearest_weekday') {
    const dow = d.getDay();
    if (dow === 6) d = addDays(d, -1); // Sat -> Fri
    else if (dow === 0) d = addDays(d, 1); // Sun -> Mon
  }
  return d;
}

function applyRules(date: Date, schedule: Schedule, holidays: Set<string>): Date {
  let d = applyHolidayRule(date, schedule.holidayRule, holidays);
  d = applyWeekendRule(d, schedule.weekendRule);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function getMonthlyFrequencyMonths(frequency: Schedule['frequency']): number {
  switch (frequency) {
    case 'monthly': return 1;
    case 'quarterly': return 3;
    case 'annual': return 12;
    default: return 0;
  }
}

function generateMonthlyDates(
  schedule: Schedule,
  windowStart: Date,
  windowEnd: Date,
  holidays: Set<string>
): Date[] {
  const dates: Date[] = [];
  const months = getMonthlyFrequencyMonths(schedule.frequency);
  if (months === 0) return dates;

  const dom = schedule.dayOfMonth ?? 1;
  const start = parseDate(schedule.startDate);
  const end = schedule.endDate ? parseDate(schedule.endDate) : null;

  let current = new Date(start.getFullYear(), start.getMonth(), 1);

  while (current <= windowEnd) {
    let day: number;
    if (dom === -1) {
      day = lastDayOfMonth(current.getFullYear(), current.getMonth());
    } else {
      day = Math.min(dom, lastDayOfMonth(current.getFullYear(), current.getMonth()));
    }

    let candidate = new Date(current.getFullYear(), current.getMonth(), day);

    if (candidate >= start && candidate >= windowStart && candidate <= windowEnd) {
      if (!end || candidate <= end) {
        const adjusted = applyRules(candidate, schedule, holidays);
        dates.push(adjusted);
      }
    }

    current = addMonths(current, months);
  }

  return dates;
}

function generateSemimonthlyDates(
  schedule: Schedule,
  windowStart: Date,
  windowEnd: Date,
  holidays: Set<string>
): Date[] {
  const dates: Date[] = [];
  const [day1, day2] = schedule.semimonthlyDays ?? [1, 15];
  const start = parseDate(schedule.startDate);
  const end = schedule.endDate ? parseDate(schedule.endDate) : null;

  let current = new Date(start.getFullYear(), start.getMonth(), 1);

  while (current <= windowEnd) {
    for (const dom of [day1, day2]) {
      let day: number;
      if (dom === -1) {
        day = lastDayOfMonth(current.getFullYear(), current.getMonth());
      } else {
        day = Math.min(dom, lastDayOfMonth(current.getFullYear(), current.getMonth()));
      }

      const candidate = new Date(current.getFullYear(), current.getMonth(), day);

      if (candidate >= start && candidate >= windowStart && candidate <= windowEnd) {
        if (!end || candidate <= end) {
          const adjusted = applyRules(candidate, schedule, holidays);
          dates.push(adjusted);
        }
      }
    }

    current = addMonths(current, 1);
  }

  return dates;
}

function generateWeeklyDates(
  schedule: Schedule,
  windowStart: Date,
  windowEnd: Date,
  holidays: Set<string>
): Date[] {
  const dates: Date[] = [];
  const dow = schedule.dayOfWeek ?? 5; // default Friday
  const weekStep = schedule.frequency === 'biweekly' ? 2 : 1;
  const start = parseDate(schedule.startDate);
  const end = schedule.endDate ? parseDate(schedule.endDate) : null;

  let current = new Date(start);
  // Align to the first occurrence of dayOfWeek on or after startDate
  while (current.getDay() !== dow) {
    current = addDays(current, 1);
  }

  while (current <= windowEnd) {
    if (current >= windowStart) {
      if (!end || current <= end) {
        const adjusted = applyRules(new Date(current), schedule, holidays);
        dates.push(adjusted);
      }
    }
    current = addDays(current, 7 * weekStep);
  }

  return dates;
}

export function generateDates(
  schedule: Schedule,
  windowStart: Date,
  windowEnd: Date,
  customHolidays: CustomHoliday[] = []
): Date[] {
  const yearsNeeded = new Set<number>();
  for (let y = windowStart.getFullYear(); y <= windowEnd.getFullYear(); y++) {
    yearsNeeded.add(y);
  }

  const allHolidays = new Set<string>();
  for (const year of yearsNeeded) {
    for (const h of getObservedHolidays(year, customHolidays)) {
      allHolidays.add(h);
    }
  }

  switch (schedule.frequency) {
    case 'weekly':
    case 'biweekly':
      return generateWeeklyDates(schedule, windowStart, windowEnd, allHolidays);
    case 'semimonthly':
      return generateSemimonthlyDates(schedule, windowStart, windowEnd, allHolidays);
    case 'monthly':
    case 'quarterly':
    case 'annual':
      return generateMonthlyDates(schedule, windowStart, windowEnd, allHolidays);
  }
}

export function nextDate(
  schedule: Schedule,
  referenceDate: Date,
  customHolidays: CustomHoliday[] = []
): Date | null {
  const windowEnd = addDays(referenceDate, 730);
  const dates = generateDates(schedule, referenceDate, windowEnd, customHolidays);
  const refKey = toDateKey(referenceDate);
  for (const d of dates) {
    if (toDateKey(d) > refKey) return d;
  }
  return null;
}
