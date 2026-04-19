export type IdentitySource = 'cookie' | 'jwt';

export interface Identity {
    sessionId: string;
    source: IdentitySource;
    issuedAt: number; // unix seconds
}

/**
 * Request augmented with resolved identity.
 * Guards attach `identity` after successful resolution.
 */
export interface RequestWithIdentity {
    identity?: Identity;
    headers: Record<string, string | string[] | undefined>;
    ip?: string;
    socket?: { remoteAddress?: string };
}
