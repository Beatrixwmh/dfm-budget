import type { CustomHoliday } from './types';

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  let day = first.getDay();
  let diff = weekday - day;
  if (diff < 0) diff += 7;
  return new Date(year, month, 1 + diff + (n - 1) * 7);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0);
  let day = last.getDay();
  let diff = day - weekday;
  if (diff < 0) diff += 7;
  return new Date(year, month, last.getDate() - diff);
}

export function getUSFederalHolidays(year: number): Date[] {
  const holidays: Date[] = [];

  // New Year's Day - Jan 1
  holidays.push(new Date(year, 0, 1));
  // MLK Day - 3rd Monday of January
  holidays.push(nthWeekdayOfMonth(year, 0, 1, 3));
  // Presidents' Day - 3rd Monday of February
  holidays.push(nthWeekdayOfMonth(year, 1, 1, 3));
  // Memorial Day - Last Monday of May
  holidays.push(lastWeekdayOfMonth(year, 4, 1));
  // Juneteenth - June 19
  holidays.push(new Date(year, 5, 19));
  // Independence Day - July 4
  holidays.push(new Date(year, 6, 4));
  // Labor Day - 1st Monday of September
  holidays.push(nthWeekdayOfMonth(year, 8, 1, 1));
  // Columbus Day - 2nd Monday of October
  holidays.push(nthWeekdayOfMonth(year, 9, 1, 2));
  // Veterans Day - Nov 11
  holidays.push(new Date(year, 10, 11));
  // Thanksgiving - 4th Thursday of November
  holidays.push(nthWeekdayOfMonth(year, 10, 4, 4));
  // Christmas - Dec 25
  holidays.push(new Date(year, 11, 25));

  return holidays;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getObservedHolidays(year: number, customHolidays: CustomHoliday[] = []): Set<string> {
  const observed = new Set<string>();

  for (const h of getUSFederalHolidays(year)) {
    const dow = h.getDay();
    if (dow === 6) {
      // Saturday -> observe Friday
      observed.add(dateKey(new Date(h.getFullYear(), h.getMonth(), h.getDate() - 1)));
    } else if (dow === 0) {
      // Sunday -> observe Monday
      observed.add(dateKey(new Date(h.getFullYear(), h.getMonth(), h.getDate() + 1)));
    } else {
      observed.add(dateKey(h));
    }
  }

  for (const ch of customHolidays) {
    observed.add(ch.date);
  }

  return observed;
}

export function isHoliday(date: Date, holidays: Set<string>): boolean {
  return holidays.has(dateKey(date));
}

export function isWeekend(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

export function toDateKey(d: Date): string {
  return dateKey(d);
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
