import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyRegistryService, ResolvedApiKey } from '../services/api-key-registry.service';
import {
    API_KEY_AUTH_KEY,
    API_KEY_HEADER,
    API_KEY_READ_METHODS,
} from '../security.constants';

interface GuardedRequest {
    method: string;
    headers: Record<string, string | string[] | undefined>;
    apiKey?: ResolvedApiKey;
}

/**
 * Guards `integration/*` routes by requiring a valid `X-API-Key`
 * header whose hash is registered in `ApiKeyRegistryService`.
 *
 * - Missing header → 401 `API_KEY_REQUIRED`
 * - Unknown key    → 401 `API_KEY_INVALID`
 * - Read-only role attempting a mutating method → 403 `API_KEY_FORBIDDEN`
 *
 * The guard is inert on handlers without `@ApiKeyAuth()` metadata, so
 * it can safely be registered globally without gating unrelated routes.
 * In practice we attach it per-integration-controller via `@UseGuards`.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(
        private readonly registry: ApiKeyRegistryService,
        private readonly reflector: Reflector,
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const required = this.reflector.getAllAndOverride<boolean>(
            API_KEY_AUTH_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (!required) return true;

        const req = context.switchToHttp().getRequest<GuardedRequest>();
        const presented = this.readHeader(req, API_KEY_HEADER);
        if (!presented) {
            throw new UnauthorizedException({
                code: 'API_KEY_REQUIRED',
                message: 'X-API-Key header is required',
            });
        }

        const entry = this.registry.verify(presented);
        if (!entry) {
            throw new UnauthorizedException({
                code: 'API_KEY_INVALID',
                message: 'API key is not recognized',
            });
        }

        if (
            entry.role === 'read-only' &&
            !API_KEY_READ_METHODS.has(req.method.toUpperCase())
        ) {
            throw new ForbiddenException({
                code: 'API_KEY_FORBIDDEN',
                message: 'Read-only API key cannot perform write operations',
            });
        }

        req.apiKey = entry;
        return true;
    }

    private readHeader(req: GuardedRequest, name: string): string | null {
        const value = req.headers[name];
        if (Array.isArray(value)) return value[0]?.trim() || null;
        if (typeof value === 'string') return value.trim() || null;
        return null;
    }
}
