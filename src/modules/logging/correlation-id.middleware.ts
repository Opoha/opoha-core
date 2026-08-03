import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { requestContext } from './app-logger';

const HEADER = 'x-request-id';
const CORRELATION_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = String(req.headers[HEADER] ?? randomUUID());
    const correlationId = String(req.headers[CORRELATION_HEADER] ?? requestId);

    res.setHeader(HEADER, requestId);
    res.setHeader(CORRELATION_HEADER, correlationId);

    requestContext.run({ requestId, correlationId }, () => next());
  }
}
