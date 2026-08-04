import { describe, expect, it } from 'vitest';

import { JOB_RUN_STATUSES, isJobRunStatus } from './job-status';

describe('job-status', () => {
  it('accepts every cataloged run status', () => {
    for (const status of JOB_RUN_STATUSES) {
      expect(isJobRunStatus(status)).toBe(true);
    }
  });

  it('rejects unknown statuses', () => {
    expect(isJobRunStatus('queued')).toBe(false);
    expect(isJobRunStatus('')).toBe(false);
  });
});
