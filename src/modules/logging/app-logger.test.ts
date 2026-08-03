import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppLogger, requestContext } from './app-logger';

describe('AppLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes structured JSON including correlation and request ids', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = new AppLogger('info');

    requestContext.run({ correlationId: 'corr-1', requestId: 'req-1' }, () => {
      logger.log('hello', 'TestContext');
    });

    expect(write).toHaveBeenCalledTimes(1);
    const line = String(write.mock.calls[0]?.[0]);
    const payload = JSON.parse(line.trim()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      level: 'info',
      message: 'hello',
      correlationId: 'corr-1',
      requestId: 'req-1',
      context: 'TestContext',
    });
    expect(typeof payload.timestamp).toBe('string');
  });

  it('suppresses debug when LOG_LEVEL is info', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = new AppLogger('info');
    logger.debug?.('noisy');
    expect(write).not.toHaveBeenCalled();
  });
});
