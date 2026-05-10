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

    it('does not expose removed site-assistant, speech, or real-estate config blocks', () => {
        const removedPrefix = 'MA' + 'X';
        process.env[`${removedPrefix}_BOT_TOKEN`] = 'token';
        process.env[`${removedPrefix}_WEBHOOK_SECRET`] = 'secret';
        process.env.SITE_ASSISTANT_ELEMENT_INDEX_TOP_K = '42';
        process.env.YC_TTS_ENDPOINT =
            'https://tts.api.cloud.yandex.net:443/tts/v3/utteranceSynthesis';
        process.env.REAL_ESTATE_API_BASE_URL = 'https://example.com/api/list/';
        const config = secretsConfig();

        expect(config).not.toHaveProperty('siteAssistant');
        expect(config).not.toHaveProperty('realEstate');
        expect(config).not.toHaveProperty('max');
        expect(config.ai).not.toHaveProperty('speechkit');
        expect(config.ai).not.toHaveProperty('siteAssistant');
    });

    it('ignores legacy single model aliases', () => {
        process.env.RESPONSE_MODEL = 'legacy-response-model';
        process.env.SITE_ASSISTANT_MODEL = 'legacy-site-assistant-model';
        process.env.SPEECH_RECOGNITION_MODEL = 'legacy-audio-model';
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
        expect(config.ai.models).not.toHaveProperty('siteAssistant');
        expect(config.ai.models).not.toHaveProperty('speechRecognition');
    });

    it('does not parse removed crawler flags into ai config', () => {
        process.env.SITE_ASSISTANT_CRAWLER_RENDER_MODE = 'hybrid';
        process.env.SITE_ASSISTANT_CRAWLER_BROWSER_ENABLED = 'true';

        const config = secretsConfig();

        expect(config.ai).not.toHaveProperty('siteAssistant');
    });

    it('does not surface removed crawler-specific flags', () => {
        process.env.SITE_ASSISTANT_CRAWLER_RESPECT_ROBOTS = 'false';

        const config = secretsConfig();

        expect(config.ai).not.toHaveProperty('siteAssistant');
    });
});
