import { Logger } from '@nestjs/common';
import { SpeechSynthesisService } from '../../services/speech-synthesis.service';

function createNdjsonResponse(lines: string[], status: number = 200): Response {
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            for (const line of lines) {
                controller.enqueue(Buffer.from(line));
            }
            controller.close();
        },
    });

    return new Response(stream, {
        status,
        headers: {
            'content-type': 'application/x-ndjson',
        },
    });
}

describe('SpeechSynthesisService', () => {
    const originalFetch = global.fetch;
    let logSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;
    let service: SpeechSynthesisService;

    const secretsConfig = {
        ai: {
            speechkit: {
                apiKey: 'test-api-key',
                iamToken: undefined,
                folderId: undefined,
                ttsEndpoint:
                    'https://tts.api.cloud.yandex.net:443/tts/v3/utteranceSynthesis',
                timeoutMs: 1000,
                maxRetries: 2,
            },
        },
    };

    beforeAll(() => {
        logSpy = jest
            .spyOn(Logger.prototype, 'log')
            .mockImplementation(() => undefined);
        warnSpy = jest
            .spyOn(Logger.prototype, 'warn')
            .mockImplementation(() => undefined);
    });

    afterAll(() => {
        global.fetch = originalFetch;
        logSpy.mockRestore();
        warnSpy.mockRestore();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        service = new SpeechSynthesisService(secretsConfig as never);
    });

    it('concatenates audio chunks from SpeechKit response', async () => {
        global.fetch = jest.fn().mockResolvedValue(
            createNdjsonResponse([
                '{"result":{"audioChunk":{"data":"Y2h1bmsx"}}}\n',
                '{"result":{"audioChunk":{"data":"Y2h1bmsy"}}}\n',
            ]),
        ) as typeof fetch;

        const result = await service.synthesize({
            text: 'Привет',
            lang: 'ru',
        });

        expect(result.contentType).toBe('audio/wav');
        expect(result.voice).toBeTruthy();
        expect(result.audio.equals(Buffer.from('chunk1chunk2'))).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
            secretsConfig.ai.speechkit.ttsEndpoint,
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Authorization: 'Api-Key test-api-key',
                    'Content-Type': 'application/json',
                }),
            }),
        );

        const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [
            string,
            RequestInit,
        ];
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;

        expect(payload.text).toBe('Привет.');
        expect(payload.hints).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    voice: result.voice,
                }),
            ]),
        );
    });

    it('switches to john for english requests without role', async () => {
        global.fetch = jest.fn().mockResolvedValue(
            createNdjsonResponse(['{"result":{"audioChunk":{"data":"ZW4="}}}\n']),
        ) as typeof fetch;

        await service.synthesize({
            text: 'Hello',
            lang: 'en',
        });

        const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [
            string,
            RequestInit,
        ];
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;

        expect(payload.hints).toEqual([{ voice: 'john' }]);
    });

    it('enables unsafe_mode for long texts', async () => {
        global.fetch = jest.fn().mockResolvedValue(
            createNdjsonResponse(['{"result":{"audioChunk":{"data":"bG9uZw=="}}}\n']),
        ) as typeof fetch;

        await service.synthesize({
            text: 'а'.repeat(251),
            lang: 'ru',
        });

        const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [
            string,
            RequestInit,
        ];
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;

        expect(payload.unsafe_mode).toBe(true);
    });

    it('normalizes markdown before sending text to SpeechKit', async () => {
        global.fetch = jest.fn().mockResolvedValue(
            createNdjsonResponse(['{"result":{"audioChunk":{"data":"b2s="}}}\n']),
        ) as typeof fetch;

        await service.synthesize({
            text: '# Заголовок\n\n- **Первый пункт**\n- [Второй](https://example.com)',
            lang: 'ru',
        });

        const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [
            string,
            RequestInit,
        ];
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;

        expect(payload.text).toBe(
            'Заголовок. <[medium]> **Первый пункт**. <[small]> Второй.',
        );
    });

    it('maps SpeechKit HTTP errors to service errors', async () => {
        service = new SpeechSynthesisService({
            ai: {
                speechkit: {
                    ...secretsConfig.ai.speechkit,
                    maxRetries: 1,
                },
            },
        } as never);

        global.fetch = jest.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    message: 'quota hit',
                }),
                {
                    status: 429,
                    headers: {
                        'content-type': 'application/json',
                    },
                },
            ),
        ) as typeof fetch;

        await expect(
            service.synthesize({
                text: 'hello',
                lang: 'en',
            }),
        ).rejects.toMatchObject({
            message: 'quota hit',
            status: 429,
        });
    });

    it('fails when SpeechKit auth is not configured', async () => {
        service = new SpeechSynthesisService({
            ai: {
                speechkit: {
                    apiKey: undefined,
                    iamToken: undefined,
                    folderId: undefined,
                    ttsEndpoint:
                        'https://tts.api.cloud.yandex.net:443/tts/v3/utteranceSynthesis',
                    timeoutMs: 1000,
                    maxRetries: 1,
                },
            },
        } as never);

        await expect(
            service.synthesize({
                text: 'hello',
                lang: 'en',
            }),
        ).rejects.toMatchObject({
            message: 'SpeechKit TTS is not configured',
            status: 503,
        });
    });
});
