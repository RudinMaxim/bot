import { redactForLog } from './redact-for-log';

describe('redactForLog', () => {
    const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
    const ORIGINAL_OVERRIDE = process.env.LOG_REDACT_USER_CONTENT;

    afterEach(() => {
        process.env.NODE_ENV = ORIGINAL_NODE_ENV;
        if (ORIGINAL_OVERRIDE === undefined) {
            delete process.env.LOG_REDACT_USER_CONTENT;
        } else {
            process.env.LOG_REDACT_USER_CONTENT = ORIGINAL_OVERRIDE;
        }
    });

    it('returns <empty> for null / undefined / empty', () => {
        expect(redactForLog(null)).toBe('<empty>');
        expect(redactForLog(undefined)).toBe('<empty>');
        expect(redactForLog('')).toBe('<empty>');
    });

    it('redacts entirely in production: only length + fingerprint', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.LOG_REDACT_USER_CONTENT;
        const out = redactForLog('user@example.com asks about price');
        expect(out).toMatch(/^<text:33c,fp=[0-9a-f]{8}>$/);
        expect(out).not.toContain('@');
        expect(out).not.toContain('example');
    });

    it('shows truncated preview + fingerprint outside production', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.LOG_REDACT_USER_CONTENT;
        const out = redactForLog('hello world');
        expect(out).toMatch(/^"hello world" <11c,fp=[0-9a-f]{8}>$/);
    });

    it('truncates long previews to previewChars (default 80) with ellipsis', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.LOG_REDACT_USER_CONTENT;
        const long = 'x'.repeat(200);
        const out = redactForLog(long);
        expect(out.startsWith('"' + 'x'.repeat(80) + '…"')).toBe(true);
        expect(out).toContain('<200c,fp=');
    });

    it('honors custom previewChars', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.LOG_REDACT_USER_CONTENT;
        const out = redactForLog('abcdefghij', { previewChars: 4 });
        expect(out.startsWith('"abcd…"')).toBe(true);
    });

    it('LOG_REDACT_USER_CONTENT=true forces redaction even in dev', () => {
        process.env.NODE_ENV = 'development';
        process.env.LOG_REDACT_USER_CONTENT = 'true';
        const out = redactForLog('still secret');
        expect(out).toMatch(/^<text:12c,fp=[0-9a-f]{8}>$/);
    });

    it('LOG_REDACT_USER_CONTENT=false forces preview even in production', () => {
        process.env.NODE_ENV = 'production';
        process.env.LOG_REDACT_USER_CONTENT = 'false';
        const out = redactForLog('debug me');
        expect(out).toMatch(/^"debug me" <8c,fp=[0-9a-f]{8}>$/);
    });

    it('fingerprint is stable for the same input across calls', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.LOG_REDACT_USER_CONTENT;
        const a = redactForLog('repeat me please');
        const b = redactForLog('repeat me please');
        expect(a).toBe(b);
    });

    it('different inputs produce different fingerprints', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.LOG_REDACT_USER_CONTENT;
        const a = redactForLog('foo');
        const b = redactForLog('bar');
        expect(a).not.toBe(b);
    });
});
