import { SiteActionRunnerService } from '../../services/site-action-runner.service';
import { WebSocketEvents } from '../constants';

function createIoMock() {
    const emit = jest.fn();
    const room = { emit };

    return {
        to: jest.fn().mockReturnValue(room),
        emit,
    };
}

function createRepositoryMock() {
    const storage = new Map<string, any>();

    return {
        save: jest.fn(async (run) => {
            storage.set(run.runId, structuredClone(run));
        }),
        get: jest.fn(async (runId: string) => storage.get(runId) ?? null),
        delete: jest.fn(async (runId: string) => {
            storage.delete(runId);
        }),
        getRunIdsByChat: jest.fn(async () => []),
        removeRunIdFromChat: jest.fn(async () => undefined),
    };
}

describe('SiteActionRunnerService', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('emits current action and preview of pending actions', async () => {
        const repo = createRepositoryMock();
        const service = new SiteActionRunnerService(repo as never);
        const ioMock = createIoMock();

        service.configure({
            io: ioMock as never,
            corsOriginsResolver: () => ['https://example.com'],
            baseUrlsResolver: () => ['https://example.com'],
        });

        await service.startRun('chat_1', 'msg_1', [
            {
                type: 'navigate_to_page',
                params: { url: 'https://example.com/catalog' },
                meta: { on_error: 'show_tooltip:Не удалось открыть страницу' },
            },
            {
                type: 'scroll_to_section',
                params: { element_id: 'catalog.section', duration: 1200 },
                meta: { on_error: 'show_tooltip:Не удалось прокрутить' },
            },
            {
                type: 'highlight_element',
                params: { element_id: 'catalog.section', duration: 2000 },
                meta: { on_error: 'show_tooltip:Не удалось подсветить' },
            },
        ]);

        expect(ioMock.to).toHaveBeenCalledWith('chat_1');
        expect(ioMock.emit).toHaveBeenCalledWith(
            WebSocketEvents.SITE_ACTIONS,
            expect.objectContaining({
                body: expect.objectContaining({
                    action: expect.objectContaining({
                        type: 'navigate_to_page',
                        params: { url: 'https://example.com/catalog' },
                    }),
                }),
                metadata: expect.objectContaining({
                    stepIndex: 1,
                    totalSteps: 3,
                    nextAction: expect.objectContaining({
                        type: 'scroll_to_section',
                        params: {
                            element_id: 'catalog.section',
                            duration: 1200,
                        },
                    }),
                    pendingActions: [
                        {
                            type: 'scroll_to_section',
                            params: {
                                element_id: 'catalog.section',
                                duration: 1200,
                            },
                            meta: {
                                on_error: 'show_tooltip:Не удалось прокрутить',
                            },
                        },
                        {
                            type: 'highlight_element',
                            params: {
                                element_id: 'catalog.section',
                                duration: 2000,
                            },
                            meta: {
                                on_error: 'show_tooltip:Не удалось подсветить',
                            },
                        },
                    ],
                }),
            }),
        );
    });
});
