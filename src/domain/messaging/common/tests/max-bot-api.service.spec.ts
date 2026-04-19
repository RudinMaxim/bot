import { SecretsConfig } from 'src/infrastructure/config/interfaces';
import { MaxBotApiService } from '../../services/max-bot-api.service';

describe('MaxBotApiService', () => {
    const secretsConfig: SecretsConfig = {
        redis: {} as never,
        rateLimit: {} as never,
        cors: {} as never,
        max: {
            botToken: 'token',
            apiBaseUrl: 'https://platform-api.max.ru',
            webhookSecret: 'secret',
            webhookPath: '/api/v1/max/webhook',
        },
        ai: {} as never,
        locales: {} as never,
        postgres: {} as never,
        embedding: {} as never,
        metrics: {} as never,
        retention: {} as never,
        security: {} as never,
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('sends a MAX text message through the bot API', async () => {
        const fetchMock = jest
            .spyOn(global, 'fetch')
            .mockResolvedValue({
                ok: true,
                json: async () => ({ message_id: 'out-1' }),
            } as Response);
        const service = new MaxBotApiService(secretsConfig);

        const result = await service.sendMessage({
            chatId: 'chat-1',
            content: 'По базе знаний нашёлся такой порядок: ...',
        });

        expect(result).toBe('out-1');
        expect(fetchMock).toHaveBeenCalledWith(
            'https://platform-api.max.ru/messages',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Authorization: 'Bearer token',
                }),
                body: JSON.stringify({
                    chat_id: 'chat-1',
                    text: 'По базе знаний нашёлся такой порядок: ...',
                }),
            }),
        );
    });
});
