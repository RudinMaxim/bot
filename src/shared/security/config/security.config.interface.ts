export interface SecurityConfig {
    session: {
        signingKey: string;
        cookieName: string;
        cookieDomain: string | undefined;
        cookieMaxAgeSec: number;
        cookieSameSite: 'none' | 'lax' | 'strict';
        cookieSecure: boolean;
    };
    jwt: {
        signingKey: string;
        ttlSec: number;
        issuer: string;
    };
    ban: {
        defaultTtlSec: number;
    };
    integration: {
        apiKeys: ReadonlyArray<IntegrationApiKeyEntry>;
    };
}

export type IntegrationApiKeyRole = 'admin' | 'read-only';

export interface IntegrationApiKeyEntry {
    readonly name: string;
    readonly hash: string;
    readonly role: IntegrationApiKeyRole;
}
