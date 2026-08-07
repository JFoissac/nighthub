import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PAGINATION } from '../config/constants';

const limitSchema = z.preprocess((value) => {
  const parsed =
    typeof value === 'string'
      ? Number.parseInt(value, 10)
      : typeof value === 'number'
        ? value
        : PAGINATION.DEFAULT_LIMIT;

  if (Number.isNaN(parsed)) {
    return PAGINATION.DEFAULT_LIMIT;
  }

  return Math.min(Math.max(parsed, 1), PAGINATION.MAX_LIMIT);
}, z.number().int());

const citySchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return 'Caen';
  }

  return value.trim().substring(0, 50);
}, z.string().regex(/^[a-zA-Z0-9\s\-_À-ÿ]+$/).catch('Caen'));

export const validateLimit = (limit: any): number => {
  const parsed = limitSchema.safeParse(limit);
  return parsed.success ? parsed.data : PAGINATION.DEFAULT_LIMIT;
};

export const validateCity = (city: any): string => {
  const parsed = citySchema.safeParse(city);
  return parsed.success ? parsed.data : 'Caen';
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
