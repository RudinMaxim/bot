import { Injectable, Logger } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type {
    IntegrationApiKeyEntry,
    IntegrationApiKeyRole,
} from '../config/security.config.interface';

export interface ResolvedApiKey {
    readonly name: string;
    readonly role: IntegrationApiKeyRole;
}

/**
 * In-memory registry of integration API keys. Keys are loaded once at
 * module construction from a parsed config (see
 * `parseSecurityConfig` / `INTEGRATION_API_KEYS`) and never mutated.
 *
 * Plaintext keys never enter the process state — only their sha256 hex
 * digests. `verify()` hashes the presented secret and compares via
 * `timingSafeEqual` against every registered digest, returning the
 * matching entry's name + role (or `null` for an unknown key).
 */
@Injectable()
export class ApiKeyRegistryService {
    private readonly logger = new Logger(ApiKeyRegistryService.name);
    private readonly entries: ReadonlyArray<IntegrationApiKeyEntry>;

    constructor(entries: ReadonlyArray<IntegrationApiKeyEntry>) {
        this.entries = entries;
        if (entries.length === 0) {
            this.logger.warn(
                'ApiKeyRegistryService initialized with no keys — ' +
                    'all integration/* routes will reject every request',
            );
        } else {
            this.logger.log(
                `ApiKeyRegistryService loaded ${entries.length} key(s)`,
            );
        }
    }

    /**
     * Verify a presented plaintext key.
     *
     * Returns `null` when the key is empty, malformed, or does not match
     * any registered digest. On match, returns the associated `name` +
     * `role` (never the hash itself).
     */
    verify(plainKey: unknown): ResolvedApiKey | null {
        if (typeof plainKey !== 'string') return null;
        const trimmed = plainKey.trim();
        if (!trimmed) return null;

        const presentedHash = createHash('sha256')
            .update(trimmed, 'utf8')
            .digest();

        for (const entry of this.entries) {
            const registered = Buffer.from(entry.hash, 'hex');
            if (registered.length !== presentedHash.length) continue;
            if (timingSafeEqual(registered, presentedHash)) {
                return { name: entry.name, role: entry.role };
            }
        }
        return null;
    }

    /**
     * Hash a plain key with sha256 → hex. Exposed for tooling that
     * generates config values (e.g. CLI, tests) so callers don't need
     * to import `crypto` directly.
     */
    static hashKey(plainKey: string): string {
        return createHash('sha256').update(plainKey, 'utf8').digest('hex');
    }
}
