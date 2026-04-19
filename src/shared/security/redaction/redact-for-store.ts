import { createHash } from 'crypto';

/**
 * PII-safe rendering of user-supplied text for **persistent storage**.
 *
 * Why this exists
 * ---------------
 * Roadmap §5 (data minimization). Several tables historically stored full
 * user prompts and bot responses (`metrics_log`, `feedback`) for triage and
 * observability. Holding raw text indefinitely is the largest single PII
 * exposure surface — phone numbers, addresses, real estate details, the
 * occasional credit card. Retention crons help, but the right answer is to
 * stop writing the raw text in the first place.
 *
 * This helper produces three artifacts that, together, preserve every
 * non-text use case the back-office has:
 *
 *  - `fingerprint`: 8-hex sha256 prefix. Stable across rows, lets you say
 *    "this is the same prompt as that one" without seeing either.
 *  - `length`: original char count. Lets you bucket "very long" vs "short"
 *    prompts in dashboards.
 *  - `preview`: first N chars (`…` if truncated). Just enough for an admin
 *    to triage "what was this feedback about" without storing the rest.
 *
 * Unlike `redactForLog`, the output here is NOT a single rendered string —
 * the caller stores the three fields in separate columns so they can be
 * indexed / aggregated.
 *
 * Empty / nullish input collapses to all-empty fields so callers don't
 * need a conditional.
 */

export interface RedactedForStore {
    fingerprint: string;
    length: number;
    preview: string;
}

export interface RedactForStoreOptions {
    /**
     * Max characters kept in the preview. Pick the smallest number that
     * still lets the back-office triage the row.
     */
    previewChars: number;
}

export function redactForStore(
    value: string | null | undefined,
    options: RedactForStoreOptions,
): RedactedForStore {
    if (value == null || value.length === 0) {
        return { fingerprint: '', length: 0, preview: '' };
    }

    const length = value.length;
    const fingerprint = createHash('sha256')
        .update(value, 'utf8')
        .digest('hex')
        .slice(0, 8);
    const preview =
        length <= options.previewChars
            ? value
            : `${value.slice(0, options.previewChars)}…`;

    return { fingerprint, length, preview };
}
