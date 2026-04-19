import {
    BadRequestException,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdentityService } from '../services/identity.service';
import {
    ChatNotOwnedError,
    ChatOwnershipService,
} from '../services/chat-ownership.service';
import { OWNS_CHAT_KEY } from '../security.constants';
import type { Identity } from '../types/identity.types';
import type { OwnsChatOptions } from '../decorators/owns-chat.decorator';

interface GuardedRequest {
    headers: Record<string, string | string[] | undefined>;
    params?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
    identity?: Identity;
}

/**
 * Enforces master spec §13b chat ownership on HTTP handlers marked
 * with `@OwnsChat({...})`.
 *
 * Flow:
 * 1. Read decorator metadata. Without it, the guard is a no-op so it
 *    is safe to register globally.
 * 2. Resolve identity from `req.identity` (set upstream by
 *    `IdentityGuard`) or fall back to `IdentityService.resolve(req)`
 *    so the guard works even before `IdentityGuard` is wired as
 *    `APP_GUARD` (Phase 1.B).
 * 3. Extract the chatId from the location named in the metadata.
 * 4. Ask `ChatOwnershipService.assertOwned()`. Mismatch / orphan ⇒
 *    403 `CHAT_NOT_OWNED`.
 *
 * Errors:
 *  - 401 `NO_IDENTITY` — request has no cookie or JWT.
 *  - 400 `BAD_CHAT_ID` — handler annotation points to a missing or
 *    malformed chatId.
 *  - 403 `CHAT_NOT_OWNED` — chatId belongs to a different session.
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly identityService: IdentityService,
        private readonly chatOwnership: ChatOwnershipService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const options = this.reflector.getAllAndOverride<OwnsChatOptions>(
            OWNS_CHAT_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (!options) return true;

        const req = context.switchToHttp().getRequest<GuardedRequest>();
        const identity = req.identity ?? this.identityService.resolve(req);
        if (!identity) {
            throw new UnauthorizedException({
                code: 'NO_IDENTITY',
                message: 'Identity required',
            });
        }
        // Cache for downstream consumers (controllers, interceptors)
        // so they don't have to resolve identity twice.
        req.identity = identity;

        const chatId = this.extractChatId(req, options);
        if (!chatId) {
            throw new BadRequestException({
                code: 'BAD_CHAT_ID',
                message: 'chatId is required',
            });
        }

        try {
            await this.chatOwnership.assertOwned(chatId, identity.sessionId);
        } catch (error) {
            if (error instanceof ChatNotOwnedError) {
                throw new ForbiddenException({
                    code: 'CHAT_NOT_OWNED',
                    message: 'Chat does not belong to current session',
                });
            }
            throw error;
        }

        return true;
    }

    private extractChatId(
        req: GuardedRequest,
        options: OwnsChatOptions,
    ): string | null {
        switch (options.source) {
            case 'param':
                return normalize(req.params?.[options.name]);
            case 'query':
                return normalize(req.query?.[options.name]);
            case 'body':
                return normalize(readDottedPath(req.body, options.name));
            case 'feedbackKey': {
                const raw = normalize(req.body?.[options.name]);
                if (!raw) return null;
                const colon = raw.indexOf(':');
                if (colon <= 0) return null;
                return raw.slice(0, colon).trim() || null;
            }
            default:
                return null;
        }
    }
}

function normalize(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function readDottedPath(
    source: Record<string, unknown> | undefined,
    path: string,
): unknown {
    if (!source) return undefined;
    const segments = path.split('.');
    let current: unknown = source;
    for (const segment of segments) {
        if (current && typeof current === 'object' && segment in current) {
            current = (current as Record<string, unknown>)[segment];
        } else {
            return undefined;
        }
    }
    return current;
}
