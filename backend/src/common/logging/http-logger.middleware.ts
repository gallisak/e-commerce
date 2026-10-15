import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '../../auth/types/auth-user.js';

const logger = new Logger('HTTP');
const SKIPPED_PATHS = new Set(['/api/health']);

export function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (SKIPPED_PATHS.has(req.path)) return next();

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const user = (req as Request & { user?: AuthUser }).user;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms${user ? ` user=${user.id}` : ''}`;
    if (res.statusCode >= 500) logger.error(message);
    else if (res.statusCode >= 400) logger.warn(message);
    else logger.log(message);
  });
  next();
}
