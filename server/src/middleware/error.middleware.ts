import { Request, Response, NextFunction } from 'express';
import { config, isProduction } from '../config/env';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  status?: string;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  // Log the error (never log stack trace in production)
  if (statusCode >= 500) {
    logger.error('Server error', err, {
      method: req.method,
      path: req.path,
      statusCode,
    });
  } else {
    // Client errors - log as warning, no stack
    logger.warn('Client error', {
      method: req.method,
      path: req.path,
      statusCode,
      message: err.message,
    });
  }

  // Build response - never expose stack trace in production
  const response: Record<string, unknown> = {
    status,
    message: err.message,
  };

  // Only include stack trace in development
  if (!isProduction() && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export class ApiError extends Error implements AppError {
  statusCode: number;
  status: string;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode >= 500 ? 'error' : 'fail';
  }
}

// Helper to create typed errors
export function badRequest(message: string): ApiError {
  return new ApiError(message, 400);
}

export function unauthorized(message: string = 'Unauthorized'): ApiError {
  return new ApiError(message, 401);
}

export function forbidden(message: string = 'Forbidden'): ApiError {
  return new ApiError(message, 403);
}

export function notFound(message: string = 'Not found'): ApiError {
  return new ApiError(message, 404);
}

export function internal(message: string = 'Internal server error'): ApiError {
  return new ApiError(message, 500);
}