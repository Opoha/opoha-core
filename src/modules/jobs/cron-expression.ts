/**
 * 5-field crontab validation (Phase 8 A-01).
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
