import 'reflect-metadata';

describe('MAX-only cleanup surface', () => {
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

    it('does not advertise widget or websocket endpoints in the server contract', () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { SERVER_CONTRACT } = require('../../../../shared/protocol/server-contract') as {
            SERVER_CONTRACT: {
                socketPath?: string;
                endpoints?: Record<string, unknown>;
            };
        };

        expect(SERVER_CONTRACT.socketPath).toBeUndefined();
        expect(SERVER_CONTRACT.endpoints).not.toHaveProperty('widget');
        expect(SERVER_CONTRACT.endpoints).not.toHaveProperty(
            'messaging.ttsSynthesis',
        );
        expect(SERVER_CONTRACT.endpoints).not.toHaveProperty(
            'system.sessionBootstrap',
        );
    });
});
