import type { NextFunction, Request, Response } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time HTTP Basic Auth middleware factory.
 *
 * The expected credentials are captured at startup and hashed once
 * (sha256 of `user:pass`). On every request the presented header is
 * decoded, hashed the same way, and compared with `timingSafeEqual` —
 * this avoids leaking either field length and keeps the comparison
 * branch-free.
 */
export function createBasicAuthMiddleware(
    expectedUser: string,
    expectedPass: string,
    realm: string = 'Restricted',
): (req: Request, res: Response, next: NextFunction) => void {
    const expectedDigest = createHash('sha256')
        .update(`${expectedUser}:${expectedPass}`, 'utf8')
        .digest();

    const sendUnauthorized = (res: Response): void => {
        res.setHeader(
            'WWW-Authenticate',
            `Basic realm="${realm}", charset="UTF-8"`,
        );
        res.status(401).send('Authentication required');
    };

    return (req: Request, res: Response, next: NextFunction): void => {
        const header = req.headers['authorization'];
        if (typeof header !== 'string' || !header.startsWith('Basic ')) {
            sendUnauthorized(res);
            return;
        }
        let decoded: string;
        try {
            decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
        } catch {
            sendUnauthorized(res);
            return;
        }
        const presentedDigest = createHash('sha256')
            .update(decoded, 'utf8')
            .digest();
        if (
            presentedDigest.length !== expectedDigest.length ||
            !timingSafeEqual(presentedDigest, expectedDigest)
        ) {
            sendUnauthorized(res);
            return;
        }
        next();
    };
}
