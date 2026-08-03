import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import { API_VERSION_HEADER } from './api-version';
import { ApiVersionMiddleware } from './api-version.middleware';

function mockRes(): Response & {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
} {
  const state = { statusCode: 200, body: undefined as unknown, headers: {} as Record<string, string> };
  return {
    get statusCode() {
      return state.statusCode;
    },
    get body() {
      return state.body;
    },
    get headers() {
      return state.headers;
    },
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      state.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      state.headers[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return state.headers[name.toLowerCase()];
    },
  } as unknown as Response & {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
  };
}

describe('ApiVersionMiddleware', () => {
  it('attaches default version when header is missing', () => {
    const middleware = new ApiVersionMiddleware();
    const req = { headers: {} } as unknown as Request;
    const res = mockRes();
    let called = false;

    middleware.use(req, res, (() => {
      called = true;
    }) as NextFunction);

    expect(called).toBe(true);
    expect(req.apiVersion).toBe('1');
    expect(res.getHeader(API_VERSION_HEADER)).toBe('1');
  });

  it('accepts X-API-Version: 2026-08-03', () => {
    const middleware = new ApiVersionMiddleware();
    const req = {
      headers: { [API_VERSION_HEADER]: '2026-08-03' },
    } as unknown as Request;
    const res = mockRes();
    let called = false;

    middleware.use(req, res, (() => {
      called = true;
    }) as NextFunction);

    expect(called).toBe(true);
    expect(req.apiVersion).toBe('1');
    expect(res.getHeader(API_VERSION_HEADER)).toBe('2026-08-03');
  });

  it('rejects unsupported versions with 400', () => {
    const middleware = new ApiVersionMiddleware();
    const req = {
      headers: { [API_VERSION_HEADER]: '9' },
    } as unknown as Request;
    const res = mockRes();
    let called = false;

    middleware.use(req, res, (() => {
      called = true;
    }) as NextFunction);

    expect(called).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
    });
  });
});
