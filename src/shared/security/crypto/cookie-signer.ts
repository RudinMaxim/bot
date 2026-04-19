import { createHmac, timingSafeEqual } from 'node:crypto';

export class CookieSigner {
    constructor(private readonly key: string) {
        if (!key || key.length < 16) {
            throw new Error('CookieSigner: signing key must be >= 16 chars');
        }
    }

    sign(sessionId: string): string {
        const sig = this.computeSignature(sessionId);
        return `${sessionId}.${sig}`;
    }

    verify(signed: string): string | null {
        if (!signed || typeof signed !== 'string') return null;
        const parts = signed.split('.');
        if (parts.length !== 2) return null;
        const [sessionId, sig] = parts;
        if (!sessionId || !sig) return null;

        const expected = this.computeSignature(sessionId);
        const expectedBuf = Buffer.from(expected, 'utf8');
        const actualBuf = Buffer.from(sig, 'utf8');
        if (expectedBuf.length !== actualBuf.length) return null;
        if (!timingSafeEqual(expectedBuf, actualBuf)) return null;
        return sessionId;
    }

    private computeSignature(sessionId: string): string {
        return createHmac('sha256', this.key)
            .update(sessionId)
            .digest('base64url');
    }
}
