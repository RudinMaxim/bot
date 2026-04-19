import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdentityService } from '../services/identity.service';
import { API_KEY_AUTH_KEY, IS_PUBLIC_KEY } from '../security.constants';
import type { Identity } from '../types/identity.types';

interface GuardedRequest {
    headers: Record<string, string | string[] | undefined>;
    identity?: Identity;
}

@Injectable()
export class IdentityGuard implements CanActivate {
    constructor(
        private readonly identityService: IdentityService,
        private readonly reflector: Reflector,
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (isPublic) return true;

        // integration/* routes authenticate via X-API-Key through
        // ApiKeyGuard — they intentionally have no widget session
        // and must not be gated by this guard.
        const isApiKeyAuth = this.reflector.getAllAndOverride<boolean>(
            API_KEY_AUTH_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (isApiKeyAuth) return true;

        const req = context.switchToHttp().getRequest<GuardedRequest>();
        const identity = this.identityService.resolve(req);
        if (!identity) {
            throw new UnauthorizedException({
                code: 'NO_IDENTITY',
                message: 'Identity required',
            });
        }
        req.identity = identity;
        return true;
    }
}
