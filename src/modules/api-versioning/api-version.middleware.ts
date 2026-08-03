import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import {
  API_VERSION_HEADER,
  DEFAULT_API_VERSION,
  resolveApiVersion,
  unsupportedApiVersionMessage,
} from './api-version';

type VersionedRequest = Request & { apiVersion?: string };

@Injectable()
export class ApiVersionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const headerValue = req.headers[API_VERSION_HEADER];
    const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const provided = typeof raw === 'string' ? raw.trim() : '';
    const resolved = resolveApiVersion(provided || undefined);

    if (resolved === null) {
      res.status(400).json({
        statusCode: 400,
        error: 'Bad Request',
        message: unsupportedApiVersionMessage(provided),
      });
      return;
    }

    (req as VersionedRequest).apiVersion = resolved;
    res.setHeader(API_VERSION_HEADER, provided || DEFAULT_API_VERSION);
    next();
  }
}
