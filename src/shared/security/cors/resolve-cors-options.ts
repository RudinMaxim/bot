/**
 * Single source of truth for CORS policy.
 *
 * Both the HTTP layer (`SecurityModule.configure` → `app.enableCors`) and the
 * Socket.IO layer (`main.ts`, `WebService.resolveCorsOrigins`) call into this
 * helper. Anything CORS-related — origins, credentials, allowed headers,
 * allowed methods, preflight cache — lives here so the two transports cannot
 * drift.
 */

export const CORS_ALLOWED_HEADERS: readonly string[] = [
    'Content-Type',
    'Authorization',
    'X-Api-Key',
    'User-Agent',
    'X-Screen-Resolution',
    'X-Timezone',
    'Accept-Language',
    'X-Platform',
    'X-Device-id',
    'X-Request-Id',
    'X-Correlation-Id',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials',
    'X-Auth-Method',
    'If-None-Match',
    'Accept',
];

export const CORS_ALLOWED_METHODS: readonly string[] = [
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'PATCH',
    'OPTIONS',
];

/** Browsers cache preflight responses up to this many seconds. */
export const CORS_PREFLIGHT_MAX_AGE_SECONDS = 600;

export interface CorsInput {
    enabled: boolean;
    origins: string[] | '*';
}

export interface ResolvedCorsOptions {
    origin: string[] | boolean;
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
    maxAge: number;
}

/**
 * Resolve the full CORS option set from config.
 *
 * Rules (enforced by browsers, not optional):
 * - `Access-Control-Allow-Origin: *` + `Access-Control-Allow-Credentials: true`
 *   is rejected by every modern browser. If origins === '*', credentials MUST be false.
 * - Empty origin list → CORS effectively disabled (origin: false).
 * - Explicit whitelist → credentials can be true (cookies, WS with `withCredentials`).
 *
 * `methods`, `allowedHeaders`, and `maxAge` are returned even when CORS is
 * disabled — they are inert in that case (origin: false short-circuits the
 * preflight) but having a stable shape avoids conditional plumbing in callers.
 */
export function resolveCorsOptions(input: CorsInput): ResolvedCorsOptions {
    const base = {
        methods: [...CORS_ALLOWED_METHODS],
        allowedHeaders: [...CORS_ALLOWED_HEADERS],
        maxAge: CORS_PREFLIGHT_MAX_AGE_SECONDS,
    };

    if (!input.enabled) {
        return { origin: false, credentials: false, ...base };
    }

    if (input.origins === '*') {
        return { origin: true, credentials: false, ...base };
    }

    if (input.origins.length === 0) {
        return { origin: false, credentials: false, ...base };
    }

    return {
        origin: [...input.origins],
        credentials: true,
        ...base,
    };
}
