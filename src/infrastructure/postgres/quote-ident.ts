/**
 * Roadmap §11 — SQL injection defense-in-depth.
 *
 * Postgres parameter placeholders (`$1`, `$2`, …) only bind VALUES.
 * They cannot bind table names, column names, or `ORDER BY` clauses.
 * If a query needs to splice an identifier dynamically (e.g. dynamic
 * sort column from a whitelist), the only safe option is to validate
 * the identifier against a strict character set and quote it.
 *
 * `quoteIdent` accepts only an unambiguous, ASCII-letter-and-digit
 * identifier — no spaces, no operators, no Unicode tricks, no NUL
 * bytes — and double-quotes it for splicing. Anything else throws,
 * loudly, before the query is built.
 *
 * Usage:
 *
 *   const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'id']);
 *   if (!ALLOWED_SORT.has(input)) throw new BadRequestException(...);
 *   // eslint-disable-next-line no-restricted-syntax -- whitelisted identifier
 *   const sql = `SELECT * FROM t ORDER BY ${quoteIdent(input)} DESC`;
 *
 * Note that `quoteIdent` is the LAST line of defence — callers should
 * still gate on a whitelist *before* calling it. The double check is
 * intentional: the whitelist captures intent ("which columns are sortable
 * by API"), and `quoteIdent` enforces the contract that nothing else
 * can possibly slip through.
 */

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function quoteIdent(name: string): string {
    if (typeof name !== 'string' || !SAFE_IDENT.test(name)) {
        throw new Error(
            `Invalid SQL identifier: ${JSON.stringify(name)}. ` +
                'Identifiers must match /^[a-zA-Z_][a-zA-Z0-9_]*$/ — ' +
                'gate on a whitelist before calling quoteIdent().',
        );
    }
    return `"${name}"`;
}
