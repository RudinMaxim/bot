import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { RequestContext } from './request-context';

export function requestContextMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const incoming =
        req.header('x-request-id') || req.header('x-correlation-id');
    const requestId = incoming?.trim() || randomUUID();
    res.setHeader('X-Request-Id', requestId);

    RequestContext.run(requestId, () => next());
}
