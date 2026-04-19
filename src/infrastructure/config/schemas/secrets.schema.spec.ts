import { validateSecretsConfig } from './secrets.schema';

describe('validateSecretsConfig', () => {
    const baseConfig = {
        POSTGRES_URL: 'postgres://postgres:postgres@postgres:5432/app',
        REDIS_HOST: 'redis',
        OPENROUTER_API_KEY: 'sk-or-test',
        MAX_BOT_TOKEN: 'token',
        MAX_WEBHOOK_SECRET: 'secret',
    };

    it('parses MAX bot settings from secrets config', () => {
        const parsed = validateSecretsConfig({
            ...baseConfig,
            MAX_BOT_TOKEN: 'token',
            MAX_BOT_API_BASE_URL: 'https://platform-api.max.ru',
            MAX_WEBHOOK_SECRET: 'secret',
        });

        expect(parsed.MAX_BOT_TOKEN).toBe('token');
        expect(parsed.MAX_BOT_API_BASE_URL).toBe(
            'https://platform-api.max.ru',
        );
        expect(parsed.MAX_WEBHOOK_SECRET).toBe('secret');
    });

    it('does not expose legacy EMBEDDING_MODEL in parsed config', () => {
        const parsed = validateSecretsConfig({
            ...baseConfig,
            EMBEDDING_MODEL: 'legacy-model',
        });

        expect(parsed).not.toHaveProperty('EMBEDDING_MODEL');
    });

    it('does not expose unused CMS URL config in parsed config', () => {
        const parsed = validateSecretsConfig({
            ...baseConfig,
            CMS_BASE_URL: 'https://cms.example.com',
            CMS_LOCALES_PATH: '/legacy/{locale}',
        });

        expect(parsed).not.toHaveProperty('CMS_BASE_URL');
        expect(parsed).not.toHaveProperty('CMS_LOCALES_PATH');
    });

    it('does not expose legacy single model aliases in parsed config', () => {
        const parsed = validateSecretsConfig({
            ...baseConfig,
            COORDINATOR_MODEL: 'legacy-coordinator',
            ANALYTICS_MODEL: 'legacy-analytics',
            RESPONSE_MODEL: 'legacy-response',
            SITE_ASSISTANT_MODEL: 'legacy-site-assistant',
            SUMMARIZATION_MODEL: 'legacy-summary',
            SPEECH_RECOGNITION_MODEL: 'legacy-audio',
        });

        expect(parsed).not.toHaveProperty('COORDINATOR_MODEL');
        expect(parsed).not.toHaveProperty('ANALYTICS_MODEL');
        expect(parsed).not.toHaveProperty('RESPONSE_MODEL');
        expect(parsed).not.toHaveProperty('SITE_ASSISTANT_MODEL');
        expect(parsed).not.toHaveProperty('SUMMARIZATION_MODEL');
        expect(parsed).not.toHaveProperty('SPEECH_RECOGNITION_MODEL');
    });
});
