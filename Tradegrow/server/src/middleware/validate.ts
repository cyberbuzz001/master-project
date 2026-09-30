import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';

/**
 * Zod-based request body validation middleware factory.
 * Returns a 400 with structured field errors if validation fails.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const zodErr = result.error as ZodError;
      const errors = zodErr.issues.map((e: ZodIssue) => ({
        field: e.path.join('.'),
        message: e.message
      }));
      const detailedMessage = errors.map(e => e.message).filter(Boolean).join('. ') || 'Request validation failed';
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: detailedMessage,
          fields: errors
        }
      });
      return;
    }
    req.body = result.data; // Replace with parsed + coerced data
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const zodErr = result.error as ZodError;
      const errors = zodErr.issues.map((e: ZodIssue) => ({
        field: e.path.join('.'),
        message: e.message
      }));
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query parameter validation failed',
          fields: errors
        }
      });
      return;
    }
    next();
  };
}
