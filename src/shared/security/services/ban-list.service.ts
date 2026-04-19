import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../infrastructure/redis';

export type BanSubjectType = 'ip' | 'session' | 'fingerprint' | 'chat';

const PREFIXES: Record<BanSubjectType, string> = {
    ip: 'ban:ip:',
    session: 'ban:session:',
    fingerprint: 'ban:fingerprint:',
    chat: 'ban:chat:',
};

export interface AddBanInput {
    type: BanSubjectType;
    value: string;
    /** seconds. undefined → default config. <= 0 → permanent. */
    ttlSec?: number;
}

export interface IsBannedInput {
    ip?: string;
    sessionId?: string;
    fingerprint?: string;
    chatId?: string;
}

export interface BanListServiceConfig {
    defaultTtlSec: number;
}

@Injectable()
export class BanListService {
    private readonly scanCount = 100;

    constructor(
        private readonly redis: RedisService,
        private readonly config: BanListServiceConfig,
    ) {}

    async add(input: AddBanInput): Promise<void> {
        if (!(input.type in PREFIXES)) {
            throw new Error(`unknown ban subject type: ${input.type}`);
        }
        if (!input.value) {
            throw new Error('ban value is required');
        }
        const key = `${PREFIXES[input.type]}${input.value}`;
        const ttl =
            input.ttlSec === undefined
                ? this.config.defaultTtlSec
                : input.ttlSec;
        await this.redis.set(key, '1', ttl > 0 ? ttl : undefined);
    }

    async remove(input: {
        type: BanSubjectType;
        value: string;
    }): Promise<void> {
        if (!(input.type in PREFIXES)) {
            throw new Error(`unknown ban subject type: ${input.type}`);
        }
        const key = `${PREFIXES[input.type]}${input.value}`;
        await this.redis.del(key);
    }

    async isBanned(input: IsBannedInput): Promise<boolean> {
        const checks: Array<[BanSubjectType, string]> = [];
        if (input.ip) checks.push(['ip', input.ip]);
        if (input.sessionId) checks.push(['session', input.sessionId]);
        if (input.fingerprint) checks.push(['fingerprint', input.fingerprint]);
        if (input.chatId) checks.push(['chat', input.chatId]);
        for (const [type, value] of checks) {
            const exists = await this.redis.exists(`${PREFIXES[type]}${value}`);
            if (exists) return true;
        }
        return false;
    }

    async list(): Promise<Record<BanSubjectType, string[]>> {
        const result: Record<BanSubjectType, string[]> = {
            ip: [],
            session: [],
            fingerprint: [],
            chat: [],
        };
        for (const type of Object.keys(PREFIXES) as BanSubjectType[]) {
            const keys = await this.scanKeys(`${PREFIXES[type]}*`);
            result[type] = keys.map((k) => k.slice(PREFIXES[type].length));
        }
        return result;
    }

    private async scanKeys(pattern: string): Promise<string[]> {
        let cursor = '0';
        const keys: string[] = [];

        do {
            const page = await this.redis.scan(cursor, pattern, this.scanCount);
            keys.push(...page.keys);
            cursor = page.cursor;
        } while (cursor !== '0');

        return keys;
    }
}
