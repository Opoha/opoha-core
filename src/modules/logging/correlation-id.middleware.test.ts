import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import { requestContext } from './app-logger';
import { CorrelationIdMiddleware } from './correlation-id.middleware';

function mockRes(): Response {
  const headers: Record<string, string> = {};
  return {
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
    getHeader: (name: string) => headers[name.toLowerCase()],
  } as unknown as Response;
}

describe('CorrelationIdMiddleware', () => {
  it('reuses incoming x-request-id and x-correlation-id', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = {
      headers: {
        'x-request-id': 'incoming-req',
        'x-correlation-id': 'incoming-corr',
      },
    } as unknown as Request;
    const res = mockRes();
    let store: { requestId?: string; correlationId?: string } | undefined;

    middleware.use(req, res, (() => {
      store = requestContext.getStore();
    }) as NextFunction);

    expect(store).toEqual({ requestId: 'incoming-req', correlationId: 'incoming-corr' });
    expect(res.getHeader('x-request-id')).toBe('incoming-req');
    expect(res.getHeader('x-correlation-id')).toBe('incoming-corr');
  });

  it('generates UUID request id when headers are missing', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = { headers: {} } as unknown as Request;
    const res = mockRes();
    let store: { requestId?: string; correlationId?: string } | undefined;

    middleware.use(req, res, (() => {
      store = requestContext.getStore();
    }) as NextFunction);

    expect(store?.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(store?.correlationId).toBe(store?.requestId);
    expect(res.getHeader('x-request-id')).toBe(store?.requestId);
  });
});
