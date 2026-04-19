import { CookieSigner } from './cookie-signer';

describe('CookieSigner', () => {
    const key = 'test-signing-key-min-32-bytes-long-xxxx';
    const signer = new CookieSigner(key);

    it('signs a sessionId into a <id>.<sig> string', () => {
        const signed = signer.sign('sess-123');
        expect(signed).toMatch(/^sess-123\.[A-Za-z0-9_-]+$/);
    });

    it('verifies a valid signature and returns the sessionId', () => {
        const signed = signer.sign('sess-abc');
        expect(signer.verify(signed)).toBe('sess-abc');
    });

    it('rejects a tampered signature', () => {
        const signed = signer.sign('sess-xyz');
        const tampered = signed.slice(0, -2) + 'aa';
        expect(signer.verify(tampered)).toBeNull();
    });

    it('rejects a tampered sessionId', () => {
        const signed = signer.sign('sess-1');
        const [, sig] = signed.split('.');
        expect(signer.verify(`sess-2.${sig}`)).toBeNull();
    });

    it('rejects malformed input', () => {
        expect(signer.verify('')).toBeNull();
        expect(signer.verify('no-dot')).toBeNull();
        expect(signer.verify('too.many.dots')).toBeNull();
    });

    it('is deterministic for the same key', () => {
        const a = new CookieSigner(key).sign('sess-1');
        const b = new CookieSigner(key).sign('sess-1');
        expect(a).toBe(b);
    });

    it('produces different signatures for different keys', () => {
        const a = new CookieSigner(key).sign('sess-1');
        const b = new CookieSigner('different-key-min-32-bytes-yyyyyyyy').sign(
            'sess-1',
        );
        expect(a).not.toBe(b);
    });
});
