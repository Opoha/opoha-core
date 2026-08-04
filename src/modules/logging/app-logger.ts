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

const REDACTED = '[REDACTED]';

/** Object keys (case-insensitive) whose values must not appear in logs. */
const SENSITIVE_KEY =
  /^(password|passwd|secret|token|refreshToken|accessToken|authorization|api[_-]?key|cookie|credential|private[_-]?key)$/i;

const BEARER_RE = /\bBearer\s+[A-Za-z0-9._\-+=/]+/gi;
const ASSIGNMENT_RE =
  /\b(password|passwd|secret|token|refreshToken|accessToken|api[_-]?key)\s*[:=]\s*([^\s,;]+)/gi;

/**
 * Redact sensitive keys in structured values and common secret patterns in strings.
 * Used by AppLogger so passwords / tokens never land in stdout/stderr.
 */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[Truncated]';
  }
  if (typeof value === 'string') {
    return value
.replace(BEARER_RE, `Bearer ${REDACTED}`)
.replace(ASSIGNMENT_RE, (_m, key: string) => `${key}=${REDACTED}`);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactSensitive(nested, depth + 1);
    }
    return out;
  }
  return value;
}

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
    const redacted = redactSensitive(message);
    if (typeof redacted === 'string') {
      return redacted;
    }
    try {
      return JSON.stringify(redacted);
    } catch {
      return String(redacted);
    }
  }

  private shouldLog(level: string): boolean {
    const min = AppLogger.levelOrder[String(this.minLevel)] ?? 3;
    const current = AppLogger.levelOrder[level] ?? 3;
    return current <= min;
  }
}
