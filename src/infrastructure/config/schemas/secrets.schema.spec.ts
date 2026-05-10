import { validateSecretsConfig } from './secrets.schema';

describe('validateSecretsConfig', () => {
    const baseConfig = {
        POSTGRES_URL: 'postgres://postgres:postgres@postgres:5432/app',
        REDIS_HOST: 'redis',
        OPENROUTER_API_KEY: 'sk-or-test',
    };

    it('does not require or expose removed bot transport settings', () => {
        const removedPrefix = 'MA' + 'X';
        const parsed = validateSecretsConfig({
            ...baseConfig,
            [`${removedPrefix}_BOT_TOKEN`]: 'token',
            [`${removedPrefix}_BOT_API_BASE_URL`]: 'https://example.invalid',
            [`${removedPrefix}_WEBHOOK_SECRET`]: 'secret',
        });

        expect(parsed).not.toHaveProperty(`${removedPrefix}_BOT_TOKEN`);
        expect(parsed).not.toHaveProperty(`${removedPrefix}_BOT_API_BASE_URL`);
        expect(parsed).not.toHaveProperty(`${removedPrefix}_WEBHOOK_SECRET`);
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

    it('does not expose removed site-assistant, speech, or real-estate env keys', () => {
        const parsed = validateSecretsConfig({
            ...baseConfig,
            SITE_ASSISTANT_AVAILABLE_MODELS: 'gpt-5.4',
            SPEECH_RECOGNITION_AVAILABLE_MODELS: 'gpt-audio-mini',
            REAL_ESTATE_API_BASE_URL: 'https://example.com/api/list/',
            YC_TTS_ENDPOINT:
                'https://tts.api.cloud.yandex.net:443/tts/v3/utteranceSynthesis',
        });

        expect(parsed).not.toHaveProperty('SITE_ASSISTANT_AVAILABLE_MODELS');
        expect(parsed).not.toHaveProperty('SPEECH_RECOGNITION_AVAILABLE_MODELS');
        expect(parsed).not.toHaveProperty('REAL_ESTATE_API_BASE_URL');
        expect(parsed).not.toHaveProperty('YC_TTS_ENDPOINT');
    });
});
