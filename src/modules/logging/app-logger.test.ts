import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppLogger, redactSensitive, requestContext } from './app-logger';

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

  it('redacts password/token fields and Bearer headers in log messages', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = new AppLogger('info');
    logger.log({
      event: 'login',
      password: 'super-secret',
      authorization: 'Bearer abc.def.ghi',
    });

    const line = String(write.mock.calls[0]?.[0]);
    const payload = JSON.parse(line.trim()) as { message: string };
    expect(line).not.toContain('super-secret');
    expect(line).not.toContain('abc.def.ghi');
    expect(payload.message).toContain('[REDACTED]');
    expect(payload.message).toContain('"event":"login"');
  });
});

describe('redactSensitive', () => {
  it('masks assignment-style secrets in free text', () => {
    expect(redactSensitive('password=hunter2 token:xyz')).toBe(
      'password=[REDACTED] token=[REDACTED]',
    );
  });
});
