import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../infrastructure/redis';

/**
 * Thrown when `bind()` is called for a chatId that already exists in
 * Redis under a *different* sessionId. Should never happen in practice
 * because chatIds are random UUIDs minted server-side per bootstrap.
 * If it does fire, treat it as either a key collision or — more
 * worryingly — as a sign that someone is racing the bootstrap endpoint.
 */
export class ChatOwnershipConflictError extends Error {
    readonly code = 'CHAT_OWNERSHIP_CONFLICT';
    constructor(public readonly chatId: string) {
        super(`chatId ${chatId} is already bound to a different session`);
    }
}

/**
 * Thrown when `assertOwned()` cannot prove that the supplied sessionId
 * owns the supplied chatId — either the mapping has expired, never
 * existed, or was issued to someone else. Translated to a 403 by the
 * `OwnershipGuard`.
 */
export class ChatNotOwnedError extends Error {
    readonly code = 'CHAT_NOT_OWNED';
    constructor(
        public readonly chatId: string,
        public readonly sessionId: string,
    ) {
        super(`session ${sessionId} does not own chat ${chatId}`);
    }
}

const KEY_PREFIX = 'chat:owner:';
const SESSION_KEY_PREFIX = 'session:chat:';

/**
 * Persists and enforces the `chatId → sessionId` mapping in Redis.
 *
 * The mapping is the linchpin of master spec §13b chat ownership: the
 * widget can only operate on a chatId issued to its own session, so an
 * attacker who learns somebody else's chatId (e.g. from a leaked URL,
 * a screenshot, or a pasted share link) cannot impersonate them.
 *
 * Mapping lifecycle:
 *  - Created in `SessionBootstrapController` immediately after
 *    `IdentityService.issue()` mints a fresh `(sessionId, chatId)` pair.
 *  - TTL is the same as the session cookie (`session.cookieMaxAgeSec`)
 *    so it expires together with the cookie's authority.
 *  - Released on session reset only when the caller proves ownership.
 */
@Injectable()
export class ChatOwnershipService {
    constructor(private readonly redis: RedisService) {}

    private key(chatId: string): string {
        return `${KEY_PREFIX}${chatId}`;
    }

    private sessionKey(sessionId: string): string {
        return `${SESSION_KEY_PREFIX}${sessionId}`;
    }

    /**
     * Atomically binds chatId to sessionId in Redis with the given TTL.
     *
     * - First call wins via `SET NX`.
     * - Idempotent: a second call from the same session is a no-op.
     * - A second call from a *different* session throws
     *   `ChatOwnershipConflictError` so the bootstrap controller can
     *   surface the situation as a 5xx (it indicates either a uuid
     *   collision or an attacker racing the endpoint).
     */
    async bind(
        chatId: string,
        sessionId: string,
        ttlSec: number,
    ): Promise<void> {
        const created = await this.redis.setIfNotExists(
            this.key(chatId),
            sessionId,
            ttlSec,
        );
        if (created) {
            await this.redis.set(this.sessionKey(sessionId), chatId, ttlSec);
            return;
        }

        // Either we're replaying a bootstrap for the same session, or
        // (much worse) two sessions clashed on the same chatId. Read
        // the existing value and decide.
        const existing = await this.redis.get<string>(this.key(chatId));
        if (existing === sessionId) {
            await this.redis.set(this.key(chatId), sessionId, ttlSec);
            await this.redis.set(this.sessionKey(sessionId), chatId, ttlSec);
            return;
        }
        throw new ChatOwnershipConflictError(chatId);
    }

    async getChatIdBySession(sessionId: string): Promise<string | null> {
        return this.redis.get<string>(this.sessionKey(sessionId));
    }

    /**
     * Returns silently when sessionId is the recorded owner of chatId.
     * Throws `ChatNotOwnedError` otherwise — including the case where
     * no mapping exists at all (orphan / expired chatId).
     */
    async assertOwned(chatId: string, sessionId: string): Promise<void> {
        const owner = await this.redis.get<string>(this.key(chatId));
        if (!owner || owner !== sessionId) {
            throw new ChatNotOwnedError(chatId, sessionId);
        }
    }

    /**
     * Releases the mapping if and only if the caller is the recorded
     * owner. Used by session reset / explicit chat deletion. Silently
     * returns when the chat is not owned by the caller — never leaks
     * info about other sessions.
     */
    async release(chatId: string, sessionId: string): Promise<void> {
        const owner = await this.redis.get<string>(this.key(chatId));
        if (owner === sessionId) {
            await this.redis.del(this.key(chatId));
            await this.redis.del(this.sessionKey(sessionId));
        }
    }
}
