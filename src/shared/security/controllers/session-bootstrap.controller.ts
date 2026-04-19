import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { IdentityService, IssuedCookieOptions } from '../services/identity.service';
import { ChatOwnershipService } from '../services/chat-ownership.service';
import { Public } from '../decorators';


function sanitizeCookieOptionsForRequest(
    req: Request,
    options: IssuedCookieOptions,
): IssuedCookieOptions {
    const configuredDomain = normalizeDomain(options.domain);
    if (!configuredDomain) {
        return options;
    }

    const requestHost = extractRequestHost(req);
    if (!requestHost || domainMatchesHost(configuredDomain, requestHost)) {
        return options;
    }

    return {
        ...options,
        domain: undefined,
    };
}

function extractRequestHost(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-host'];
    const hostHeader = Array.isArray(forwarded)
        ? forwarded[0]
        : typeof forwarded === 'string'
          ? forwarded
          : req.headers.host;
    if (!hostHeader) {
        return null;
    }

    const first = hostHeader.split(',')[0]?.trim();
    if (!first) {
        return null;
    }

    return normalizeDomain(first);
}

function normalizeDomain(value?: string | null): string | null {
    const normalized = value?.trim().replace(/^\./, '').toLowerCase();
    if (!normalized) {
        return null;
    }

    return normalized.replace(/:\d+$/, '');
}

function domainMatchesHost(domain: string, host: string): boolean {
    return host === domain || host.endsWith(`.${domain}`);
}


@Controller('session')
export class SessionBootstrapController {
    constructor(
        private readonly identityService: IdentityService,
        private readonly chatOwnership: ChatOwnershipService,
    ) {}

    @Public()
    @Get('bootstrap')
    async bootstrap(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<{
        sessionId: string;
        chatId: string;
        jwt: string;
        expiresInSec: number;
    }> {
        const existingIdentity = this.identityService.resolve(req);
        const existingChatId = existingIdentity
            ? await this.chatOwnership.getChatIdBySession(
                  existingIdentity.sessionId,
              )
            : null;
        const issued =
            existingIdentity && existingChatId
                ? this.identityService.reissue(
                      existingIdentity.sessionId,
                      existingChatId,
                  )
                : this.identityService.issue();
        const expiresInSec = Math.floor(issued.cookieOptions.maxAge / 1000);
        await this.chatOwnership.bind(
            issued.chatId,
            issued.sessionId,
            expiresInSec,
        );
        res.cookie(
            issued.cookieName,
            issued.cookieValue,
            sanitizeCookieOptionsForRequest(req, issued.cookieOptions),
        );
        return {
            sessionId: issued.sessionId,
            chatId: issued.chatId,
            jwt: issued.jwt,
            expiresInSec,
        };
    }
}
