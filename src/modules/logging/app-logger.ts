import { Injectable, type LoggerService } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export type LogContext = {
  correlationId?: string;
  requestId?: string;
};

type JsonLog = {
  level: string;
  message: string;
  timestamp: string;
  correlationId?: string;
  requestId?: string;
  context?: string;
  stack?: string;
  [key: string]: unknown;
};

export const requestContext = new AsyncLocalStorage<LogContext>();

@Injectable()
export class AppLogger implements LoggerService {
  private static readonly levelOrder: Record<string, number> = {
    fatal: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    verbose: 5,
  };

  constructor(private readonly minLevel: string = 'info') {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug?(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose?(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  fatal?(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  private write(level: string, message: unknown, optionalParams: unknown[]): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const store = requestContext.getStore();
    const context =
      typeof optionalParams[optionalParams.length - 1] === 'string'
        ? (optionalParams[optionalParams.length - 1] as string)
        : undefined;

    const payload: JsonLog = {
      level,
      message: this.stringifyMessage(message),
      timestamp: new Date().toISOString(),
      correlationId: store?.correlationId,
      requestId: store?.requestId,
      context,
    };

    const stack = optionalParams.find((param) => typeof param === 'string' && param.includes('\n'));
    if (typeof stack === 'string' && stack !== context) {
      payload.stack = stack;
    }

    const line = `${JSON.stringify(payload)}\n`;
    if (level === 'error' || level === 'fatal') {
      process.stderr.write(line);
      return;
    }
    process.stdout.write(line);
  }

  private stringifyMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }

  private shouldLog(level: string): boolean {
    const min = AppLogger.levelOrder[String(this.minLevel)] ?? 3;
    const current = AppLogger.levelOrder[level] ?? 3;
    return current <= min;
  }
}
