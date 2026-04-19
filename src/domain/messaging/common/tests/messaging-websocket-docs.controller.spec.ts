import { GlobalConfig } from 'src/infrastructure/config';
import { MessagingWebSocketDocsController } from '../../controller/messaging-websocket-docs.controller';

describe('MessagingWebSocketDocsController', () => {
    it('documents the WebSocket endpoint on the HTTP server port', () => {
        const controller = new MessagingWebSocketDocsController({
            env: {
                isProduction: false,
                isDevelopment: true,
                isLocalhost: true,
                isStaging: false,
            },
            server: {
                host: '127.0.0.1',
                port: 3500,
                version: '0.1.0',
                logLevel: 'info',
                swagger: {
                    enabled: false,
                    path: 'api-docs',
                },
            },
        } as GlobalConfig);

        const response = controller.getWebSocketDocs();

        expect(response.data?.endpoint).toBe('ws://127.0.0.1:3500/chat');
        expect(response.data?.path).toBe('/chat');
    });
});
