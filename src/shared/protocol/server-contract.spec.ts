import { SERVER_CONTRACT } from './server-contract';
import { WEB_SOCKET_PATH } from '../../domain/messaging/common/constants';
import { API_KEY_HEADER } from '../security/security.constants';

/**
 * Guarantees the widget cannot silently drift from the backend contract.
 *
 * Backend consumers (`WEB_SOCKET_PATH`, `API_KEY_HEADER`) must equal the
 * values declared in the shared workspace contract package. This ensures
 * the backend itself is using the same source as the widget.
 */
describe('server contract', () => {
    it('backend constants mirror the SSoT (drift protection)', () => {
        expect(WEB_SOCKET_PATH).toBe(SERVER_CONTRACT.socketPath);
        expect(API_KEY_HEADER.toLowerCase()).toBe(
            SERVER_CONTRACT.headers.apiKey.toLowerCase(),
        );
    });
});
