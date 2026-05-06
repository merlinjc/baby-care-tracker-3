import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { ValidationError } from '../types/errors';

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ValidationError(result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')));
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new ValidationError(result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')));
    }
    req.query = result.data as typeof req.query;
    next();
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return next(new ValidationError(result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')));
    }
    req.params = result.data as typeof req.params;
    next();
  };
}
