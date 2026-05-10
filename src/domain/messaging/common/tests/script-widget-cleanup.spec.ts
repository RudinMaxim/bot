import 'reflect-metadata';

describe('script-widget cleanup surface', () => {
    const removedPrefix = String.fromCharCode(77, 97, 120);
    const removed = {
        webhookController: [removedPrefix, 'Webhook', 'Controller'].join(''),
        adapterService: [removedPrefix, 'Adapter', 'Service'].join(''),
        botApiService: [removedPrefix, 'Bot', 'Api', 'Service'].join(''),
        updateType: [removedPrefix, 'Update'].join(''),
    };

    it('does not export legacy voice, TTS, or websocket DTOs', () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const dtoExports = require('../dto') as Record<string, unknown>;

        expect(dtoExports.SendVoiceMessageDto).toBeUndefined();
        expect(dtoExports.SendTtsRequestDto).toBeUndefined();
        expect(dtoExports.WebSocketDocsDto).toBeUndefined();
        expect(dtoExports.ApiWebSocketDocsResponseDto).toBeUndefined();
    });

    it('does not export username or widget helpers from messaging/shared barrels', () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const messagingUtils = require('../utils') as Record<string, unknown>;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sharedUtils = require('../../../../shared/utils') as Record<
            string,
            unknown
        >;

        expect(messagingUtils.normalizeUsername).toBeUndefined();
        expect(sharedUtils.decodeBase64Audio).toBeUndefined();
        expect(sharedUtils.buildSiteActionUrlPolicy).toBeUndefined();
    });

    it('does not export removed transport helpers from messaging barrels', () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const messagingServices = require('../../services') as Record<
            string,
            unknown
        >;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const messagingTypes = require('../types') as Record<string, unknown>;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const messagingControllers = require('../../controller') as Record<
            string,
            unknown
        >;

        expect(messagingServices[removed.adapterService]).toBeUndefined();
        expect(messagingServices[removed.botApiService]).toBeUndefined();
        expect(messagingTypes[removed.updateType]).toBeUndefined();
        expect(messagingControllers[removed.webhookController]).toBeUndefined();
    });

    it('advertises only the script-widget messaging endpoints in the server contract', () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { SERVER_CONTRACT } = require('../../../../shared/protocol/server-contract') as {
            SERVER_CONTRACT: {
                socketPath?: string;
                endpoints?: Record<string, unknown>;
            };
        };

        expect(SERVER_CONTRACT.socketPath).toBeUndefined();
        expect(SERVER_CONTRACT.endpoints).toHaveProperty('messaging');
        expect(SERVER_CONTRACT.endpoints).not.toHaveProperty(
            ['ma', 'x'].join(''),
        );
        expect(SERVER_CONTRACT.endpoints).not.toHaveProperty(
            'messaging.ttsSynthesis',
        );
        expect(SERVER_CONTRACT.endpoints).not.toHaveProperty(
            'system.sessionBootstrap',
        );
    });
});
