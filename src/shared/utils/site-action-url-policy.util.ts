export function normalizeNavigationUrl(
    value: unknown,
    baseUrl?: string,
): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const raw = value.trim();
    if (!raw) {
        return undefined;
    }

    try {
        const parsed = baseUrl ? new URL(raw, baseUrl) : new URL(raw);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return undefined;
        }

        parsed.username = '';
        parsed.password = '';
        parsed.hash = '';
        parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
        return parsed.toString();
    } catch {
        return undefined;
    }
}

export function normalizeOrigin(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '*') {
        return undefined;
    }

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return undefined;
        }
        return parsed.origin;
    } catch {
        try {
            const parsed = new URL(`https://${trimmed}`);
            return parsed.origin;
        } catch {
            return undefined;
        }
    }
}

export function resolveAllowedOrigins(
    corsOrigins: string[] | '*' | undefined,
    crawlerBaseUrls: string[] | undefined,
): Set<string> {
    const allowedOrigins = new Set<string>();
    const corsList = corsOrigins === '*' ? [] : (corsOrigins ?? []);
    const candidates = [...corsList, ...(crawlerBaseUrls ?? [])];

    for (const item of candidates) {
        const origin = normalizeOrigin(item);
        if (origin) {
            allowedOrigins.add(origin);
        }
    }

    return allowedOrigins;
}

export function isSafeNavigationTarget(
    targetUrl: string,
    currentUrl: string | undefined,
    allowedOrigins: ReadonlySet<string>,
    knownTargets: ReadonlySet<string>,
): boolean {
    const normalizedTargetUrl = normalizeNavigationUrl(targetUrl);
    if (!normalizedTargetUrl) {
        return false;
    }

    let target: URL;
    try {
        target = new URL(normalizedTargetUrl);
    } catch {
        return false;
    }

    if (allowedOrigins.size > 0 && !allowedOrigins.has(target.origin)) {
        return false;
    }

    const normalizedCurrentUrl = normalizeNavigationUrl(currentUrl);
    if (currentUrl && !normalizedCurrentUrl) {
        return false;
    }

    if (normalizedCurrentUrl) {
        try {
            const current = new URL(normalizedCurrentUrl);
            if (current.origin !== target.origin) {
                return false;
            }
        } catch {
            return false;
        }
    }

    if (!normalizedCurrentUrl && allowedOrigins.size === 0) {
        return false;
    }

    if (knownTargets.size === 0) {
        return true;
    }

    if (knownTargets.has(normalizedTargetUrl)) {
        return true;
    }

    return Boolean(normalizedCurrentUrl);
}
