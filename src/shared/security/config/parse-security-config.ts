import type {
    SecurityConfig,
    IntegrationApiKeyEntry,
    IntegrationApiKeyRole,
} from './security.config.interface';

export interface ParseSecurityConfigWarning {
    field: string;
    message: string;
}

export interface ParseSecurityConfigResult {
    config: SecurityConfig;
    warnings: ParseSecurityConfigWarning[];
}

const MIN_KEY_BYTES = 32;
const SAME_SITE_VALUES = ['none', 'lax', 'strict'] as const;
type SameSite = (typeof SAME_SITE_VALUES)[number];

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
    const value = env[name];
    if (!value || !value.trim()) {
        throw new Error(`${name} is required`);
    }
    return value.trim();
}

function assertKeyStrength(field: string, value: string): void {
    const byteLen = Buffer.byteLength(value, 'utf8');
    if (byteLen < MIN_KEY_BYTES) {
        throw new Error(
            `${field} must be at least ${MIN_KEY_BYTES} bytes ` +
                `(got ${byteLen}). Generate one with: ` +
                `openssl rand -base64 48`,
        );
    }
}

function parseSameSite(field: string, raw: string | undefined): SameSite {
    const value = (raw ?? 'none').trim().toLowerCase();
    if (!(SAME_SITE_VALUES as readonly string[]).includes(value)) {
        throw new Error(
            `${field} must be one of ${SAME_SITE_VALUES.join(' | ')}, got "${raw}"`,
        );
    }
    return value as SameSite;
}

function parsePositiveInt(
    field: string,
    raw: string | undefined,
    fallback: number,
): number {
    if (raw === undefined || raw.trim() === '') return fallback;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`${field} must be a positive integer, got "${raw}"`);
    }
    return n;
}

/**
 * Parse and validate security config from env. Pure — no NestJS, no side effects.
 *
 * Throws on hard errors (missing / weak keys, invalid enums, forbidden combos).
 * Returns soft warnings for recoverable footguns (e.g. JWT key reuse).
 */
export function parseSecurityConfig(
    env: NodeJS.ProcessEnv,
): ParseSecurityConfigResult {
    const warnings: ParseSecurityConfigWarning[] = [];

    const sessionSigningKey = requireEnv(env, 'SESSION_SIGNING_KEY');
    assertKeyStrength('SESSION_SIGNING_KEY', sessionSigningKey);

    const cookieSameSite = parseSameSite(
        'SESSION_COOKIE_SAMESITE',
        env.SESSION_COOKIE_SAMESITE,
    );
    const cookieSecure = env.SESSION_COOKIE_SECURE !== 'false';

    if (cookieSameSite === 'none' && !cookieSecure) {
        throw new Error(
            'SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true ' +
                '(browsers reject SameSite=None without Secure)',
        );
    }

    // JWT key: prefer dedicated JWT_SIGNING_KEY. Fallback to session key
    // only in non-production environments, and warn loudly.
    const dedicatedJwtKey = env.JWT_SIGNING_KEY?.trim();
    let jwtSigningKey: string;
    if (dedicatedJwtKey) {
        jwtSigningKey = dedicatedJwtKey;
    } else {
        if (env.NODE_ENV === 'production') {
            throw new Error(
                'JWT_SIGNING_KEY is required in production. ' +
                    'Do not reuse SESSION_SIGNING_KEY (key reuse across ' +
                    'HMAC algorithms is insecure).',
            );
        }
        jwtSigningKey = sessionSigningKey;
        warnings.push({
            field: 'JWT_SIGNING_KEY',
            message:
                'JWT_SIGNING_KEY is not set — falling back to SESSION_SIGNING_KEY. ' +
                'This is allowed in dev only. Set a dedicated key for production.',
        });
    }
    assertKeyStrength('JWT_SIGNING_KEY', jwtSigningKey);

    const integrationApiKeys = parseIntegrationApiKeys(
        env.INTEGRATION_API_KEYS,
        env.NODE_ENV,
        warnings,
    );

    const config: SecurityConfig = {
        session: {
            signingKey: sessionSigningKey,
            cookieName: env.SESSION_COOKIE_NAME?.trim() || 'dai_sid',
            cookieDomain: env.SESSION_COOKIE_DOMAIN?.trim() || undefined,
            cookieMaxAgeSec: parsePositiveInt(
                'SESSION_COOKIE_MAX_AGE_SEC',
                env.SESSION_COOKIE_MAX_AGE_SEC,
                86_400,
            ),
            cookieSameSite,
            cookieSecure,
        },
        jwt: {
            signingKey: jwtSigningKey,
            ttlSec: parsePositiveInt('JWT_TTL_SEC', env.JWT_TTL_SEC, 3_600),
            issuer: env.JWT_ISSUER?.trim() || 'developer-ai',
        },
        ban: {
            defaultTtlSec: parsePositiveInt(
                'BAN_DEFAULT_TTL_SEC',
                env.BAN_DEFAULT_TTL_SEC,
                3_600,
            ),
        },
        integration: {
            apiKeys: integrationApiKeys,
        },
    };

    return { config, warnings };
}

const INTEGRATION_ROLES: ReadonlySet<IntegrationApiKeyRole> = new Set([
    'admin',
    'read-only',
]);
const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Parses `INTEGRATION_API_KEYS` env var into a typed registry list.
 *
 * Format: comma-separated entries, each `name:sha256hex:role`.
 *   - `name`   — human label (for logs / audit)
 *   - `hash`   — lowercase sha256 hex of the secret key (64 chars)
 *   - `role`   — `admin` or `read-only`
 *
 * Empty/unset → returns `[]`. In production this emits a warning; the
 * `ApiKeyGuard` will then reject every `integration/*` request with
 * `API_KEY_REQUIRED`, which is the correct safe-by-default behavior.
 */
function parseIntegrationApiKeys(
    raw: string | undefined,
    nodeEnv: string | undefined,
    warnings: ParseSecurityConfigWarning[],
): IntegrationApiKeyEntry[] {
    const value = raw?.trim();
    if (!value) {
        if (nodeEnv === 'production') {
            warnings.push({
                field: 'INTEGRATION_API_KEYS',
                message:
                    'INTEGRATION_API_KEYS is empty — all integration/* endpoints ' +
                    'will reject every request with API_KEY_REQUIRED. Set at ' +
                    'least one admin key before exposing integration routes.',
            });
        }
        return [];
    }

    const entries: IntegrationApiKeyEntry[] = [];
    const seenHashes = new Set<string>();
    const rawEntries = value.split(',');
    for (let i = 0; i < rawEntries.length; i++) {
        const rawEntry = rawEntries[i].trim();
        if (!rawEntry) continue;
        const parts = rawEntry.split(':');
        if (parts.length !== 3) {
            throw new Error(
                `INTEGRATION_API_KEYS[${i}]: expected "name:sha256hex:role", ` +
                    `got "${rawEntry}"`,
            );
        }
        const [name, hashRaw, roleRaw] = parts.map((p) => p.trim());
        if (!name) {
            throw new Error(
                `INTEGRATION_API_KEYS[${i}]: name must not be empty`,
            );
        }
        const hash = hashRaw.toLowerCase();
        if (!SHA256_HEX.test(hash)) {
            throw new Error(
                `INTEGRATION_API_KEYS[${i}]: hash must be 64 lowercase hex ` +
                    `chars (sha256), got "${hashRaw}"`,
            );
        }
        if (!INTEGRATION_ROLES.has(roleRaw as IntegrationApiKeyRole)) {
            throw new Error(
                `INTEGRATION_API_KEYS[${i}]: role must be admin | read-only, ` +
                    `got "${roleRaw}"`,
            );
        }
        if (seenHashes.has(hash)) {
            throw new Error(
                `INTEGRATION_API_KEYS[${i}]: duplicate hash — two entries ` +
                    `share the same secret`,
            );
        }
        seenHashes.add(hash);
        entries.push({
            name,
            hash,
            role: roleRaw as IntegrationApiKeyRole,
        });
    }

    return entries;
}
