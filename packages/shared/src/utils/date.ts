/**
 * @fileoverview Date and time utilities
 * Purpose: Handle timezone conversions and scheduling
 */

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export function addHours(date: Date, hours: number): Date {
  return addMinutes(date, hours * 60);
}

export function isFutureDate(date: Date): boolean {
  return date.getTime() > Date.now();
}

export function parseISOString(isoString: string): Date {
  return new Date(isoString);
}

export function toISOString(date: Date): string {
  return date.toISOString();
}

export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function convertToTimezone(date: Date, timezone: string): string {
  return date.toLocaleString('en-US', { timeZone: timezone });
}
