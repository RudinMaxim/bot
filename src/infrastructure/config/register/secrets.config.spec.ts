import { secretsConfig } from './secrets.config';

describe('secretsConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = {
            ...originalEnv,
            NODE_ENV: 'development',
            POSTGRES_URL: 'postgres://postgres:postgres@postgres:5432/app',
            REDIS_HOST: 'redis',
            OPENROUTER_API_KEY: 'sk-or-test',
            SESSION_SIGNING_KEY:
                'dev-session-signing-key-change-me-min-32-bytes-abcdef',
            JWT_SIGNING_KEY:
                'dev-jwt-signing-key-change-me-min-32-bytes-abcdef',
        };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('builds site assistant runtime settings under ai.siteAssistant', () => {
        process.env.SITE_ASSISTANT_ELEMENT_INDEX_TOP_K = '42';
        process.env.SITE_ASSISTANT_CRAWLER_BASE_URLS =
            'https://example.com, https://example.org/';

        const config = secretsConfig();

        expect(config).not.toHaveProperty('siteAssistant');
        expect(config.ai.siteAssistant.elementIndex.topK).toBe(42);
        expect(config.ai.siteAssistant.crawler.baseUrls).toEqual([
            'https://example.com',
            'https://example.org',
        ]);
    });

    it('ignores legacy single model aliases', () => {
        process.env.RESPONSE_MODEL = 'legacy-response-model';
        process.env.SITE_ASSISTANT_MODEL = 'legacy-site-assistant-model';
        delete process.env.RESPONSE_AVAILABLE_MODELS;
        delete process.env.SITE_ASSISTANT_AVAILABLE_MODELS;

        const config = secretsConfig();

        expect(config.ai.models.response).toEqual([
            'gpt-5.4-nano',
            'gpt-5.4-mini',
            'gpt-5.4',
        ]);
        expect(config.ai.models.response).not.toContain(
            'legacy-response-model',
        );
        expect(config.ai.models.siteAssistant).toEqual([
            'gpt-5.4-nano',
            'gpt-5.4-mini',
            'gpt-5.4',
        ]);
        expect(config.ai.models.siteAssistant).not.toContain(
            'legacy-response-model',
        );
        expect(config.ai.models.siteAssistant).not.toContain(
            'legacy-site-assistant-model',
        );
    });

    it('parses crawler render and browser flags', () => {
        process.env.SITE_ASSISTANT_CRAWLER_RENDER_MODE = 'hybrid';
        process.env.SITE_ASSISTANT_CRAWLER_BROWSER_ENABLED = 'true';
        process.env.SITE_ASSISTANT_CRAWLER_BROWSER_TIMEOUT_MS = '15000';
        process.env.SITE_ASSISTANT_CRAWLER_BROWSER_WAIT_UNTIL =
            'domcontentloaded';
        process.env.SITE_ASSISTANT_CRAWLER_BROWSER_POST_LOAD_DELAY_MS = '1000';

        const config = secretsConfig();

        expect(config.ai.siteAssistant.crawler.renderMode).toBe('hybrid');
        expect(config.ai.siteAssistant.crawler.browser.enabled).toBe(true);
        expect(config.ai.siteAssistant.crawler.browser.timeoutMs).toBe(15000);
        expect(config.ai.siteAssistant.crawler.browser.waitUntil).toBe(
            'domcontentloaded',
        );
        expect(config.ai.siteAssistant.crawler.browser.postLoadDelayMs).toBe(
            1000,
        );
    });

    it('always enables robots respect in crawler config', () => {
        process.env.SITE_ASSISTANT_CRAWLER_RESPECT_ROBOTS = 'false';

        const config = secretsConfig();

        expect(config.ai.siteAssistant.crawler).not.toHaveProperty(
            'respectRobots',
        );
    });
});
