import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { BanListService } from '../services/ban-list.service';
import type { Identity } from '../types/identity.types';

interface GuardedRequest {
    ip?: string;
    socket?: { remoteAddress?: string };
    identity?: Identity;
    headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class BanGuard implements CanActivate {
    constructor(private readonly banList: BanListService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<GuardedRequest>();
        const ip = req.ip ?? req.socket?.remoteAddress ?? undefined;
        const sessionId = req.identity?.sessionId;
        const banned = await this.banList.isBanned({ ip, sessionId });
        if (banned) {
            throw new ForbiddenException({
                code: 'BANNED',
                message: 'Access denied',
            });
        }
        return true;
    }
}
