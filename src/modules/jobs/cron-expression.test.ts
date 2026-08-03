import { describe, expect, it } from 'vitest';

import {
  assertCronExpression,
  cronMatchesAt,
  isValidCronExpression,
} from './cron-expression';

describe('cron-expression (A-01/A-04)', () => {
  it('accepts standard 5-field crontab expressions', () => {
    const valid = [
      '*/5 * * * *',
      '0 * * * *',
      '0 0 * * *',
      '30 2 * * 1',
      '*   *   *   *   *',
    ];
    for (const expr of valid) {
      expect(isValidCronExpression(expr)).toBe(true);
      expect(assertCronExpression(expr)).toBe(expr.trim());
    }
  });

  it('rejects empty, blank, and malformed expressions', () => {
    const invalid = [
      '',
      '   ',
      '* * * *',
      '* * * * * *',
      'not a cron',
      '*/x * * * *',
    ];
    for (const expr of invalid) {
      expect(isValidCronExpression(expr)).toBe(false);
      expect(() => assertCronExpression(expr)).toThrow(
        /Invalid cron expression/,
      );
    }
  });

  it('trims surrounding whitespace before validating', () => {
    expect(isValidCronExpression('  0 0 * * *  ')).toBe(true);
    expect(assertCronExpression('  0 0 * * *  ')).toBe('0 0 * * *');
  });

  it('matches due times for step and hourly expressions (UTC)', () => {
    const atHour = new Date('2026-08-04T04:00:00Z');
    const atOne = new Date('2026-08-04T04:01:00Z');
    expect(cronMatchesAt('*/5 * * * *', atHour)).toBe(true);
    expect(cronMatchesAt('*/5 * * * *', atOne)).toBe(false);
    expect(cronMatchesAt('0 * * * *', atHour)).toBe(true);
    expect(cronMatchesAt('0 * * * *', atOne)).toBe(false);
  });
});
