import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            'eslint.config.mjs',
            '**/*.spec.ts',
            '**/*.test.ts',
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    eslintPluginPrettierRecommended,
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
            },
            ecmaVersion: 5,
            sourceType: 'module',
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-floating-promises': 'warn',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            // Roadmap §11 — SQL injection defense-in-depth.
            //
            // Bans template-literal interpolation in any *.query(...) call:
            //   this.postgres.query(`SELECT * FROM x WHERE id = '${id}'`)
            // The only safe pattern is parameterised queries:
            //   this.postgres.query('SELECT * FROM x WHERE id = $1', [id])
            //
            // The select matches a CallExpression whose callee is a member
            // expression ending in `.query(`, with a TemplateLiteral first
            // argument that has at least one `${...}` expression. Plain
            // template literals (multi-line SQL with no interpolation)
            // pass — they are how all current call-sites are written.
            //
            // Whitelist: places that legitimately need to splice an
            // identifier (column name in dynamic ORDER BY, etc.) MUST
            // use `quoteIdent()` from `src/infrastructure/postgres` and
            // disable this rule on a single line with a comment that
            // explains why.
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        "CallExpression[callee.property.name='query'] > TemplateLiteral[expressions.length>0]",
                    message:
                        'SQL injection guard (§11): use parameterised queries ($1, $2, …) instead of template-literal interpolation. For dynamic identifiers, use quoteIdent() and disable this rule on the line with a justification.',
                },
            ],
        },
    },
);
