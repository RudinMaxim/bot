import type { Server as HttpServer } from 'node:http';
import { Server as SocketIoServer } from 'socket.io';
import {
    MAX_AUDIO_FILE_SIZE_BYTES,
    WEB_SOCKET_PATH,
} from '../constants';
import { createSocketIoServer } from '../utils/socket-io-server.util';

jest.mock('socket.io', () => ({
    Server: jest.fn().mockImplementation((server, options) => ({
        server,
        options,
    })),
}));

describe('createSocketIoServer', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('attaches Socket.IO to the existing HTTP server on the chat path', () => {
        const httpServer = { on: jest.fn() } as unknown as HttpServer;
        const cors = { origin: ['https://example.com'] };

        const io = createSocketIoServer(httpServer, cors);

        expect(SocketIoServer).toHaveBeenCalledWith(
            httpServer,
            expect.objectContaining({
                cors,
                path: WEB_SOCKET_PATH,
                transports: ['websocket'],
                maxHttpBufferSize: Math.max(
                    Math.min(MAX_AUDIO_FILE_SIZE_BYTES, 10 * 1024 * 1024) * 2,
                    1e6,
                ),
                serveClient: false,
                allowEIO3: true,
            }),
        );
        expect(SocketIoServer).not.toHaveBeenCalledWith(
            expect.any(Number),
            expect.anything(),
        );
        expect(io).toEqual({ server: httpServer, options: expect.any(Object) });
    });
});
