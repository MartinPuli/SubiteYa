import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getLogger } from '@subiteya/observability';
import type { RequestContext } from '../types/express';

const REQUEST_ID_HEADER = 'x-request-id';

export function requestContextMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const headerValue = req.headers[REQUEST_ID_HEADER] as string | undefined;
    const traceId = headerValue?.trim() || randomUUID();
    const startTime = Date.now();

    const context: RequestContext = {
      traceId,
      ip: req.ip,
    };

    req.context = context;
    req.logger = getLogger({ requestId: traceId });

    res.setHeader('X-Request-Id', traceId);

    req.logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });

    res.on('finish', () => {
      req.logger?.info('Request completed', {
        statusCode: res.statusCode,
        durationMs: Date.now() - startTime,
      });
    });

    next();
  };
}
