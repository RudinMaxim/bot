import { SetMetadata } from '@nestjs/common';
import { OWNS_CHAT_KEY } from '../security.constants';

/**
 * Where the OwnershipGuard should look for the chatId on the incoming
 * request.
 *
 * - `param` — `request.params[name]` (e.g. `:chatId` in the route).
 * - `query` — `request.query[name]`.
 * - `body` — dotted path inside `request.body` (e.g. `body.chatId` for
 *   the nested DTO `{ body: { chatId } }`). Walks the path one segment
 *   at a time and rejects anything that resolves to a non-string.
 * - `feedbackKey` — value at `request.body[name]` is parsed as
 *   `${chatId}:${messageId}`. Used by `POST /messaging/feedback`,
 *   which historically encodes the chat reference into a key.
 */
export type OwnsChatSource = 'param' | 'query' | 'body' | 'feedbackKey';

export interface OwnsChatOptions {
    source: OwnsChatSource;
    /** Field name (or dotted path for `body`). */
    name: string;
}

/**
 * Marks an HTTP handler as operating on a specific chatId so that the
 * `OwnershipGuard` can verify the calling session owns it. The guard
 * is inert on handlers that lack this metadata, so it is safe to mount
 * globally later (Phase 1.B) without breaking unrelated routes.
 */
export const OwnsChat = (options: OwnsChatOptions) =>
    SetMetadata(OWNS_CHAT_KEY, options);
