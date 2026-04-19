const DEFAULT_USERNAME = 'web_user';

export function normalizeUsername(raw?: string): string {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    return trimmed || DEFAULT_USERNAME;
}
