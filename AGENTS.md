## Workflow: Superpowers + Beads + Templates

Before starting ANY task, invoke `template-bridge:unified-workflow` skill to load the full workflow.

### Quick Reference (do NOT skip steps)

1. **Epic** — `bd create -t epic "Goal"` (container for intent + context)
2. **Brainstorm** — `superpowers:brainstorming` (design before code)
3. **Plan** — `superpowers:writing-plans` (2-5 min tasks)
4. **Sub-tasks** — `bd create` for each + `bd dep add` (parent-child, blocks)
5. **Isolate** — `superpowers:using-git-worktrees` (non-trivial work)
6. **Implement** — `bd ready` → pick → `bd update --claim` → TDD (RED → GREEN → REFACTOR)
7. **Review** — `superpowers:requesting-code-review`
8. **Verify** — `superpowers:verification-before-completion` (evidence before claims)
9. **Finish** — `superpowers:finishing-a-development-branch`
10. **Close** — `bd close <epic-id> --reason "Done"`

### Rules

- No production code without a failing test first
- No completion claims without running verification commands
- No work without a beads task
- **Always query Context7 before implementing with any library/framework** (`resolve-library-id` → `query-docs`)
- Check `template-bridge:template-catalog` when a specialist agent is needed
- Side quests: `bd create -t bug` + `bd dep add new current --type discovered-from`


<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax


<!-- nx configuration end-->