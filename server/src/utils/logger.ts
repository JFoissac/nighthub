import { config } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

function isDev(): boolean {
  try {
    return config.nodeEnv !== 'production';
  } catch {
    // If config is not available (e.g., in tests with incomplete mocks), assume dev
    return true;
  }
}

function shouldLog(level: LogLevel): boolean {
  if (isDev()) return true;
  // In production, don't log debug
  if (level === 'debug') return false;
  return true;
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (!shouldLog('debug')) return;
    console.debug(formatMessage('debug', message, context));
  },

  info(message: string, context?: LogContext): void {
    if (!shouldLog('info')) return;
    console.info(formatMessage('info', message, context));
  },

  warn(message: string, context?: LogContext): void {
    if (!shouldLog('warn')) return;
    console.warn(formatMessage('warn', message, context));
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    if (!shouldLog('error')) return;
    const errorContext: LogContext = { ...context };
    if (error instanceof Error) {
      errorContext.errorName = error.name;
      errorContext.errorMessage = error.message;
      // Never log stack trace - only in development
      if (isDev()) {
        errorContext.stack = error.stack;
      }
    } else if (error !== undefined) {
      errorContext.error = String(error);
    }
    console.error(formatMessage('error', message, errorContext));
  },
};

// Sanitize function for logging - removes sensitive data
export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'apiKey',
    'bearerToken',
    'authorization',
    'cookie',
    'accessToken',
    'refreshToken',
  ];

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLog(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}