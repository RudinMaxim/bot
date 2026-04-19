import { createHash } from 'crypto';

/**
 * PII-safe rendering of user-supplied text for application logs.
 *
 * Why this exists
 * ---------------
 * Several hot-path log lines used to interpolate raw user prompts (truncated
 * to 80–100 chars). That is enough to leak phone numbers, emails, addresses,
 * or sensitive questions into stdout — and from there into whatever log sink
 * is wired up. The roadmap §P2.7 calls this out as a P2 finding.
 *
 * Behaviour
 * ---------
 * - Production (`NODE_ENV === 'production'`): redact entirely. Output looks
 *   like `<text:147c,fp=8a3b21de>`. The fingerprint is a non-reversible
 *   sha256 prefix and is stable across log lines, so an operator can still
 *   correlate "the same prompt" across multiple traces without ever seeing
 *   the prompt itself.
 *
 * - Anywhere else (dev / test / staging): keep the truncated preview AND
 *   the same fingerprint, so a developer can read what happened locally
 *   while CI still exercises the redaction code path. Output looks like
 *   `"hello world..." <147c,fp=8a3b21de>`.
 *
 * - Override: `LOG_REDACT_USER_CONTENT=true|false` flips the mode without
 *   touching `NODE_ENV`. Useful for staging that wants prod-like redaction
 *   or for a one-off debug session in prod.
 *
 * Empty / nullish input collapses to `<empty>` so callers don't need a
 * conditional.
 */

export interface RedactForLogOptions {
    /** Max preview length when redaction is OFF. Defaults to 80. */
    previewChars?: number;
}

const DEFAULT_PREVIEW_CHARS = 80;

function shouldRedact(): boolean {
    const override = process.env.LOG_REDACT_USER_CONTENT;
    if (override === 'true') return true;
    if (override === 'false') return false;
    return process.env.NODE_ENV === 'production';
}

function fingerprint(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 8);
}

function previewOf(value: string, max: number): string {
    if (value.length <= max) return value;
    return `${value.slice(0, max)}…`;
}

export function redactForLog(
    value: string | null | undefined,
    options: RedactForLogOptions = {},
): string {
    if (value == null || value.length === 0) {
        return '<empty>';
    }

    const length = value.length;
    const fp = fingerprint(value);

    if (shouldRedact()) {
        return `<text:${length}c,fp=${fp}>`;
    }

    const max = options.previewChars ?? DEFAULT_PREVIEW_CHARS;
    return `"${previewOf(value, max)}" <${length}c,fp=${fp}>`;
}
