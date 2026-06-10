import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PAGINATION } from '../config/constants';

export const validateLimit = (limit: any): number => {
  const parsed = parseInt(limit, 10);
  if (isNaN(parsed) || parsed < 1) return PAGINATION.DEFAULT_LIMIT;
  if (parsed > PAGINATION.MAX_LIMIT) return PAGINATION.MAX_LIMIT;
  return parsed;
};

export const validateCity = (city: any): string => {
  if (typeof city !== 'string' || !/^[a-zA-Z0-9\s\-_À-ÿ]+$/.test(city)) {
    return 'Caen';
  }
  return city.substring(0, 50);
};

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten().fieldErrors });
      return;
    }
    (req as any).validatedBody = parsed.data as z.infer<T>;
    next();
  };
}
