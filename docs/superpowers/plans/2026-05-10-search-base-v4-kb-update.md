# Search Base V4 KB Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the reference v4 knowledge-base contract into this project and migrate the FAC runtime JSON to that contract with current `kb.md` data.

**Architecture:** Keep the existing resource path and search-base service boundaries. Replace the asset contract from v2 knowledge-unit fields with v4 `steps`, `category`, `queries`, `guardrails`, and `followUpStepIds`; seed embeddings from compact `title/queries/answer` text while storing full card content.

**Tech Stack:** TypeScript, NestJS, Jest, Zod, JSON runtime assets.

---

### Task 1: Lock V4 Contract With Tests

**Files:**
- Modify: `src/domain/search-base/common/tests/search-base-asset-loader.util.spec.ts`
- Modify: `src/domain/search-base/common/tests/search-base-docx-seed.util.spec.ts`
- Modify: `src/domain/ai/common/tests/knowledge-base-assets.spec.ts`

- [ ] **Step 1: Write failing tests**

Assert that v4 payloads require top-level `steps`, v4 items use `category`, `queries`, `guardrails`, optional `followUpStepIds`, and the FAC asset has `dataset: accreditation`, `version: 4`, real FAC cards, and follow-up steps.

- [ ] **Step 2: Run RED**

Run: `npm run test -- src/domain/search-base/common/tests/search-base-asset-loader.util.spec.ts src/domain/search-base/common/tests/search-base-docx-seed.util.spec.ts src/domain/ai/common/tests/knowledge-base-assets.spec.ts`

Expected: FAIL because current code accepts v2 fields and current JSON has no `steps`.

### Task 2: Port V4 Runtime Contract

**Files:**
- Modify: `src/domain/search-base/common/types/search-base-asset.types.ts`
- Modify: `src/domain/search-base/common/types/search-base.types.ts`
- Modify: `src/domain/search-base/common/utils/search-base-asset-loader.util.ts`
- Modify: `src/domain/search-base/common/utils/search-base-docx-seed.util.ts`
- Modify: `src/infrastructure/vectorization/common/utils/search-base.util.ts`
- Modify: `src/domain/ai/agents/search/search.agent.ts`

- [ ] **Step 1: Implement minimal v4 schema**

Add `steps`, validate unique item ids, unique step ids, step target ids, item follow-up references, no self-targeting links, and max 5 follow-ups per item.

- [ ] **Step 2: Update seed generation**

Build stored content with `category/title/queries/answer/guardrails` and embedding text with `title/queries/answer`.

- [ ] **Step 3: Update search structured parsing**

Rank structured matches using `queries:` and `answer:` instead of `search_phrases:` and `facts:`.

- [ ] **Step 4: Run GREEN**

Run the same targeted Jest command and fix only failures related to the v4 migration.

### Task 3: Migrate FAC JSON

**Files:**
- Modify: `resources/knowledge-base/search-base/mys/ru.json`

- [ ] **Step 1: Convert v2 fields to v4**

Map `topic -> category`, `search_phrases -> queries`, `restrictions -> guardrails`, and merge facts missing from answers.

- [ ] **Step 2: Add current FAC entries from `kb.md`**

Ensure FAC overview, accreditation, contacts, schedule, location, education, and key specialist cards are represented as searchable cards.

- [ ] **Step 3: Add follow-up steps**

Create reusable FAC-oriented steps and attach up to five per card.

- [ ] **Step 4: Verify JSON**

Run the targeted Jest command again.

### Task 4: Final Verification

**Files:**
- No new production files.

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 2: Run targeted tests**

Run: `npm run test -- src/domain/search-base/common/tests/search-base-asset-loader.util.spec.ts src/domain/search-base/common/tests/search-base-docx-seed.util.spec.ts src/domain/ai/common/tests/knowledge-base-assets.spec.ts`

Expected: PASS.
