import {
    isSafeNavigationTarget,
    normalizeNavigationUrl,
    normalizeOrigin,
    resolveAllowedOrigins,
} from './site-action-url-policy.util';

describe('site-action-url-policy.util', () => {
    it('normalizes relative URL and strips hash/credentials', () => {
        const normalized = normalizeNavigationUrl(
            '/catalog/#top',
            'https://user:pass@example.com/home',
        );

        expect(normalized).toBe('https://example.com/catalog');
    });

    it('blocks javascript/mailto/tel protocols', () => {
        expect(normalizeNavigationUrl('javascript:alert(1)')).toBeUndefined();
        expect(normalizeNavigationUrl('mailto:test@example.com')).toBeUndefined();
        expect(normalizeNavigationUrl('tel:+123')).toBeUndefined();
    });

    it('canonicalizes trailing slash', () => {
        expect(normalizeNavigationUrl('https://example.com/catalog///')).toBe(
            'https://example.com/catalog',
        );
        expect(normalizeNavigationUrl('https://example.com/')).toBe(
            'https://example.com/',
        );
    });

    it('canonicalizes same-page urls for reliable equality checks', () => {
        const current = normalizeNavigationUrl('https://example.com/home/');
        const target = normalizeNavigationUrl(
            '/home/#section',
            'https://example.com/home',
        );

        expect(current).toBe('https://example.com/home');
        expect(target).toBe('https://example.com/home');
    });

    it('resolves allowed origins from CORS and crawler config', () => {
        const origins = resolveAllowedOrigins(
            ['https://example.com', 'frontend.local'],
            ['https://example.com/base', 'https://demo.test'],
        );

        expect(origins).toEqual(
            new Set([
                'https://example.com',
                'https://frontend.local',
                'https://demo.test',
            ]),
        );
    });

    it('normalizes origin from host without protocol', () => {
        expect(normalizeOrigin('example.com')).toBe('https://example.com');
    });

    it('blocks external origin targets', () => {
        const allowed = new Set(['https://example.com']);
        const known = new Set<string>();

        const isSafe = isSafeNavigationTarget(
            'https://evil.com/path',
            undefined,
            allowed,
            known,
        );

        expect(isSafe).toBe(false);
    });

    it('requires known target when no current URL and knownTargets is non-empty', () => {
        const allowed = new Set(['https://example.com']);
        const known = new Set(['https://example.com/catalog']);

        expect(
            isSafeNavigationTarget(
                'https://example.com/catalog',
                undefined,
                allowed,
                known,
            ),
        ).toBe(true);

        expect(
            isSafeNavigationTarget(
                'https://example.com/contacts',
                undefined,
                allowed,
                known,
            ),
        ).toBe(false);
    });
});
