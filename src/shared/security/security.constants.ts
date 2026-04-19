import { SERVER_CONTRACT } from '../protocol/server-contract';

export const IS_PUBLIC_KEY = 'isPublic';
export const OWNS_CHAT_KEY = 'security:ownsChat';
export const API_KEY_AUTH_KEY = 'security:apiKeyAuth';
/**
 * HTTP header the ApiKeyGuard reads. Sourced from the server contract
 * SSoT — changing the name requires editing
 * `src/shared/protocol/server-contract.ts`.
 *
 * Lowercased here because Express / Nest normalise incoming header
 * names to lowercase before we compare them.
 */
export const API_KEY_HEADER = SERVER_CONTRACT.headers.apiKey.toLowerCase();
export const API_KEY_READ_METHODS: ReadonlySet<string> = new Set([
    'GET',
    'HEAD',
    'OPTIONS',
]);
