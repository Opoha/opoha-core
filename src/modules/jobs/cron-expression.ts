/**
 * 5-field crontab validation + due matching.
 * minute hour day-of-month month day-of-week
 */
const CRON_FIELD = String.raw`(?:\*|(?:\*/\d+)|(?:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)|(?:\d+/\d+))`;
const FIVE_FIELD_CRON = new RegExp(
  `^${CRON_FIELD}\\s+${CRON_FIELD}\\s+${CRON_FIELD}\\s+${CRON_FIELD}\\s+${CRON_FIELD}$`,
);

export function isValidCronExpression(expression: string): boolean {
  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    return false;
  }
  return FIVE_FIELD_CRON.test(trimmed);
}

export function assertCronExpression(expression: string): string {
  const trimmed = expression.trim();
  if (!isValidCronExpression(trimmed)) {
    throw new Error(
      `Invalid cron expression "${expression}" — expected 5-field crontab (minute hour day-of-month month day-of-week)`,
    );
  }
  return trimmed;
}

/**
 * Whether a validated 5-field cron expression matches `at` in the given IANA
 * timezone (default UTC). Used by the memory queue `runDueAt` smoke path.
 */
export function cronMatchesAt(expression: string, at: Date, timezone = 'UTC'): boolean {
  const cron = assertCronExpression(expression);
  const parts = cron.split(/\s+/);
  const [minuteF, hourF, domF, monthF, dowF] = parts;
  const partsInTz = getZonedParts(at, timezone);
  return (
    fieldMatches(minuteF!, partsInTz.minute, 0, 59) &&
    fieldMatches(hourF!, partsInTz.hour, 0, 23) &&
    fieldMatches(domF!, partsInTz.dayOfMonth, 1, 31) &&
    fieldMatches(monthF!, partsInTz.month, 1, 12) &&
    fieldMatches(dowF!, partsInTz.dayOfWeek, 0, 6)
  );
}

type ZonedParts = {
  minute: number;
  hour: number;
  dayOfMonth: number;
  month: number;
  /** 0 = Sunday … 6 = Saturday (crontab). */
  dayOfWeek: number;
};

function getZonedParts(at: Date, timezone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(at)) {
    if (part.type !== 'literal') {
      bag[part.type] = part.value;
    }
  }
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    minute: Number(bag.minute),
    hour: Number(bag.hour),
    dayOfMonth: Number(bag.day),
    month: Number(bag.month),
    dayOfWeek: weekdayMap[bag.weekday ?? 'Sun'] ?? 0,
  };
}

function fieldMatches(field: string, value: number, min: number, max: number): boolean {
  if (field === '*') {
    return true;
  }
  for (const token of field.split(',')) {
    if (tokenIncludes(token, value, min, max)) {
      return true;
    }
  }
  return false;
}

function tokenIncludes(token: string, value: number, min: number, max: number): boolean {
  if (token.startsWith('*/')) {
    const step = Number(token.slice(2));
    if (!Number.isFinite(step) || step <= 0) {
      return false;
    }
    return (value - min) % step === 0;
  }
  const slash = token.indexOf('/');
  if (slash >= 0) {
    const rangePart = token.slice(0, slash);
    const step = Number(token.slice(slash + 1));
    if (!Number.isFinite(step) || step <= 0) {
      return false;
    }
    const [lo, hi] = parseRange(rangePart, min, max);
    if (value < lo || value > hi) {
      return false;
    }
    return (value - lo) % step === 0;
  }
  const [lo, hi] = parseRange(token, min, max);
  return value >= lo && value <= hi;
}

function parseRange(token: string, min: number, max: number): [number, number] {
  if (token === '*') {
    return [min, max];
  }
  const dash = token.indexOf('-');
  if (dash >= 0) {
    return [Number(token.slice(0, dash)), Number(token.slice(dash + 1))];
  }
  const n = Number(token);
  return [n, n];
}
