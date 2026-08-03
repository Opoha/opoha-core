import { describe, expect, it } from 'vitest';

import {
  assertCronExpression,
  isValidCronExpression,
} from './cron-expression';
import { isJobRunStatus, JOB_RUN_STATUSES } from './job-status';

describe('cron-expression (A-01)', () => {
  it('accepts standard 5-field expressions', () => {
    expect(isValidCronExpression('*/5 * * * *')).toBe(true);
    expect(isValidCronExpression('0 * * * *')).toBe(true);
    expect(isValidCronExpression('0 0 * * *')).toBe(true);
    expect(isValidCronExpression('30 2 * * 1')).toBe(true);
    expect(assertCronExpression('  0 * * * *  ')).toBe('0 * * * *');
  });

  it('rejects empty or wrong field counts', () => {
    expect(isValidCronExpression('')).toBe(false);
    expect(isValidCronExpression('* * * *')).toBe(false);
    expect(isValidCronExpression('* * * * * *')).toBe(false);
    expect(() => assertCronExpression('not-a-cron')).toThrow(/Invalid cron/);
  });
});

describe('job-status (A-01/A-02)', () => {
  it('enumerates observability statuses', () => {
    expect(JOB_RUN_STATUSES).toEqual([
      'pending',
      'running',
      'succeeded',
      'failed',
      'canceled',
    ]);
    expect(isJobRunStatus('succeeded')).toBe(true);
    expect(isJobRunStatus('unknown')).toBe(false);
  });
});
