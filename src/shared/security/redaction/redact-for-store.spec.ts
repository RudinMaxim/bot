import { redactForStore } from './redact-for-store';

describe('redactForStore', () => {
    it('collapses null / undefined / empty to all-empty fields', () => {
        const empty = { fingerprint: '', length: 0, preview: '' };
        expect(redactForStore(null, { previewChars: 80 })).toEqual(empty);
        expect(redactForStore(undefined, { previewChars: 80 })).toEqual(empty);
        expect(redactForStore('', { previewChars: 80 })).toEqual(empty);
    });

    it('keeps short text verbatim in preview', () => {
        const out = redactForStore('hello', { previewChars: 240 });
        expect(out.length).toBe(5);
        expect(out.preview).toBe('hello');
        expect(out.fingerprint).toMatch(/^[0-9a-f]{8}$/);
    });

    it('truncates long text to previewChars and appends ellipsis', () => {
        const long = 'x'.repeat(500);
        const out = redactForStore(long, { previewChars: 240 });
        expect(out.length).toBe(500);
        expect(out.preview).toBe('x'.repeat(240) + '…');
    });

    it('reports the original length, not the preview length', () => {
        const out = redactForStore('a'.repeat(1000), { previewChars: 80 });
        expect(out.length).toBe(1000);
        expect(out.preview.length).toBe(81); // 80 chars + ellipsis
    });

    it('produces stable fingerprints for identical inputs', () => {
        const a = redactForStore('repeat me please', { previewChars: 80 });
        const b = redactForStore('repeat me please', { previewChars: 80 });
        expect(a.fingerprint).toBe(b.fingerprint);
    });

    it('produces different fingerprints for different inputs', () => {
        const a = redactForStore('foo', { previewChars: 80 });
        const b = redactForStore('bar', { previewChars: 80 });
        expect(a.fingerprint).not.toBe(b.fingerprint);
    });

    it('does not leak full text into the fingerprint', () => {
        const out = redactForStore('user@example.com asks about price', {
            previewChars: 10,
        });
        expect(out.fingerprint).not.toContain('@');
        expect(out.fingerprint).not.toContain('example');
        expect(out.fingerprint.length).toBe(8);
    });
});
