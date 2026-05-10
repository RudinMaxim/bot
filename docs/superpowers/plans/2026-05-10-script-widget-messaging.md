# Script Widget Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old bot transport with a minimal embeddable messaging widget loaded by a single script tag.

**Architecture:** Keep `MessageService` as the transport-neutral core. Add a `MessagingWidgetController` that issues a server-owned session/chat pair, serves `widget.js` and `widget.css`, accepts text messages, and returns JSON for the tiny vanilla JS client. Remove the old bot-specific controllers, services, types, config, contracts, tests, and docs.

**Tech Stack:** NestJS controllers, existing security `IdentityService` and `ChatOwnershipService`, vanilla JavaScript, plain CSS, Jest.

---

### Task 1: RED Tests For Widget Surface

**Files:**
- Create: `src/domain/messaging/common/tests/messaging-widget.controller.spec.ts`
- Modify: `src/domain/messaging/common/tests/messaging.module.spec.ts`
- Modify: `src/domain/messaging/common/tests/max-only-cleanup.spec.ts`

- [x] **Step 1: Write failing tests**

Add tests that expect:
- `MessagingModule` exposes `MessagingWidgetController`, `MessageService`, and `MessageCacheRepository`.
- `MessagingModule` no longer exposes the removed bot transport controller or providers.
- `MessagingWidgetController.startSession()` reuses an existing chat for a cookie session and returns history.
- `MessagingWidgetController.sendMessage()` requires owned chat metadata and delegates to `MessageService`.
- Messaging barrels and server contract do not export old bot runtime pieces.

- [x] **Step 2: Run RED command**

Run:

```powershell
npm run test -- src/domain/messaging/common/tests/messaging-widget.controller.spec.ts src/domain/messaging/common/tests/messaging.module.spec.ts src/domain/messaging/common/tests/script-widget-cleanup.spec.ts
```

Expected: FAIL because `MessagingWidgetController` does not exist and module metadata still points at the old transport.

### Task 2: Implement Script Widget Transport

**Files:**
- Create: `src/domain/messaging/controller/messaging-widget.controller.ts`
- Create: `src/domain/messaging/common/dto/messaging-widget.dto.ts`
- Create: `src/domain/messaging/common/assets/widget-js.asset.ts`
- Create: `src/domain/messaging/common/assets/widget-css.asset.ts`
- Modify: `src/domain/messaging/controller/index.ts`
- Modify: `src/domain/messaging/common/dto/index.ts`
- Modify: `src/domain/messaging/messaging.module.ts`

- [x] **Step 1: Implement controller and DTOs**

Add routes:
- `GET /api/v1/messaging/widget.js`
- `GET /api/v1/messaging/widget.css`
- `POST /api/v1/messaging/session`
- `POST /api/v1/messaging/messages`
- `POST /api/v1/messaging/clear`

Use `IdentityService.issue()` / `reissue()`, `ChatOwnershipService.bind()`, and existing `MessageService`.

- [x] **Step 2: Implement minimal assets**

`widget.js` mounts a fixed button and small chat window, keeps `chatId` in localStorage as a cache, calls `/session`, renders history, and posts messages.

`widget.css` uses minimal neutral styling with one red brand accent.

- [x] **Step 3: Run widget tests**

Run:

```powershell
npm run test -- src/domain/messaging/common/tests/messaging-widget.controller.spec.ts src/domain/messaging/common/tests/messaging.module.spec.ts
```

Expected: PASS.

### Task 3: Remove Old Bot Runtime

**Files:**
- Delete: `src/domain/messaging/controller/max-webhook.controller.ts`
- Delete: `src/domain/messaging/services/max-adapter.service.ts`
- Delete: `src/domain/messaging/services/max-bot-api.service.ts`
- Delete: removed bot transport types and tests from `src/domain/messaging/common`
- Modify: `src/domain/messaging/services/index.ts`
- Modify: `src/domain/messaging/common/types/index.ts`
- Modify: `src/infrastructure/config/schemas/secrets.schema.ts`
- Modify: `src/infrastructure/config/register/secrets.config.ts`
- Modify: `src/infrastructure/config/interfaces/secrets.interface.ts`
- Modify: `src/shared/protocol/server-contract.ts`
- Modify: `README.md`

- [x] **Step 1: Remove old transport exports and config**

Remove old bot transport config requirements and contract routes. Keep generic retry settings only if used as HTTP retry count.

- [x] **Step 2: Run cleanup tests**

Run:

```powershell
npm run test -- src/domain/messaging/common/tests/script-widget-cleanup.spec.ts src/infrastructure/config/register/secrets.config.spec.ts src/infrastructure/config/schemas/secrets.schema.spec.ts
```

Expected: PASS after tests are renamed or updated to script-widget cleanup semantics.

### Task 4: Verify

**Files:**
- All changed files.

- [x] **Step 1: Run focused messaging tests**

```powershell
npm run test -- src/domain/messaging/common/tests/messaging-widget.controller.spec.ts src/domain/messaging/common/tests/messaging.module.spec.ts src/domain/messaging/common/tests/script-widget-cleanup.spec.ts src/domain/messaging/common/tests/message.service.spec.ts src/domain/messaging/repository/message-cache.repository.spec.ts
```

- [x] **Step 2: Run typecheck**

```powershell
npm run typecheck
```

- [x] **Step 3: Run full tests**

```powershell
npm run test
```

If unrelated pre-existing failures remain, report exact suites and errors.
