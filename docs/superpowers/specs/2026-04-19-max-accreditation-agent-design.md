# MAX Accreditation Agent Design

## Status

- Date: 2026-04-19
- Scope: narrow the assistant to accreditation support and migrate transport from widget/websocket to MAX messenger
- Goal: keep only knowledge-base answering, clarification, and specialist routing in a MAX-only bot backend

## Goal

Build a narrow accreditation support bot for MAX messenger that:

- answers user questions from the knowledge base in simple Russian;
- understands incomplete, colloquial, and imprecise requests;
- asks 1-2 short clarification questions when the request is too vague;
- gives a verified partial answer plus specialist contact when the knowledge base is not enough;
- routes the user to the right specialist when the answer is missing or not reliable enough;
- removes widget, web, websocket, site-assistant, settings, and TTS behavior that is not needed for this scenario.

## Product Constraints

- The agent is not a general-purpose assistant.
- The agent does not perform external business integrations or side effects for end users.
- The runtime transport is MAX messenger only.
- The agent must not invent facts, deadlines, documents, contacts, or rules.
- The agent must not expose technical architecture or internal implementation details to the user.
- The primary language is Russian only.
- Service HTTP endpoints may remain for system operations such as health checks, knowledge-base refresh, and feedback handling.

## In Scope

- Search an internal accreditation knowledge base.
- Produce a short practical answer when the knowledge base is sufficient.
- Ask up to two short clarification questions when needed.
- Provide a partial answer plus specialist contact when confidence is not high enough.
- Route directly to a specialist when the knowledge base does not provide a reliable answer.
- Select a specialist from a local JSON catalog using question topics.
- Accept incoming MAX bot updates through webhook delivery.
- Send outgoing replies back to MAX through the bot API.
- Keep service endpoints needed for health, knowledge-base refresh, and feedback.

## Out Of Scope

- Any workflow for real estate, ЖК “Мыс”, MR Group, apartment подбор, infrastructure, mortgage, site navigation, or consultation booking.
- Widget chat, browser chat, HTTP chat endpoints for the old web widget, and WebSocket chat transport.
- Site assistant flows, site actions, site assistant element indexing, or browser automation assistance.
- TTS, speech recognition, audio upload flows, and voice synthesis endpoints.
- Widget settings, site assistant settings, generic integration settings, and locale settings management through old controllers.
- Form submission or action-execution pipelines for end users.

## Current State Summary

The repository still contains two different states:

### Already aligned with the target

- `src/domain/ai/services/orchestrator.service.ts` now uses an active path limited to coordinator, search, and response.
- `src/domain/ai/agents/coordinator` now works around four explicit modes:
  - `answer`
  - `clarify`
  - `partial_with_specialist`
  - `route_to_specialist`
- `src/domain/ai/agents/response/response.agent.ts` now formats deterministic MAX-ready replies instead of using the old real-estate persona.
- `src/domain/ai/services/specialist-catalog.service.ts` and `resources/knowledge-base/specialists/ru.json` provide specialist routing grounded in local JSON data.
- `src/domain/ai/agents/search/search.agent.ts` returns `coverage` metadata with `full | partial | none`.
- `src/domain/ai/services/ai.service.ts` no longer uses the old fast path for the assistant persona.

### Still misaligned with the target

- `src/domain/messaging` is still centered around `WebAdapterService`, `MessagingGateway`, widget HTTP controllers, TTS, speech recognition, and site-action support.
- `src/infrastructure/integration/integration.module.ts` still exposes widget/settings/site-assistant controllers.
- `src/domain/settings` still exists only to support widget and site-assistant settings behavior that is no longer part of the product.
- `src/domain/ai/agents/site-assistant` and related infrastructure are still present even though they are out of scope.
- Locale management is still modeled around widget-side update flows instead of MAX transport metadata.

## Target User Experience

### Reliable answer from the knowledge base

The user receives:

- one short introduction sentence;
- a short paragraph or 2-5 simple steps;
- no specialist routing.

### Vague request

The user receives:

- one or two short clarification questions;
- no assumptions presented as facts.

### Partial knowledge-base coverage

The user receives:

- the useful verified part of the answer;
- a short note that the remaining part is better clarified with a specialist;
- specialist full name, position, and contact.

### No reliable answer

The user receives:

- a short statement that there is no reliable answer in the knowledge base;
- routing to a profile specialist;
- a short explanation of what the specialist helps with.

## Architecture

The system is reduced to three product concerns:

1. `MAX transport`
2. `AI / knowledge base / specialist routing`
3. `Service endpoints`

### MAX Transport

The runtime transport becomes MAX-only and webhook-first.

Incoming path:

1. MAX sends bot updates to a dedicated webhook controller.
2. The MAX transport layer validates and normalizes the update.
3. A normalized internal message is passed to the existing message-processing service.
4. The AI pipeline returns a deterministic reply.
5. The MAX bot API client sends the reply back to MAX.

Required transport units:

- `MaxWebhookController`
- `MaxAdapterService`
- `MaxBotApiClient`

Responsibilities:

- accept incoming webhook updates from MAX;
- normalize MAX events into the internal message contract;
- send outbound text replies and later callback replies if needed;
- keep MAX-specific details out of the AI domain.

Transport rules:

- use webhook subscriptions as the production transport mode;
- do not keep long polling as a supported runtime mode;
- keep the messaging abstraction transport-agnostic where practical, but remove widget/websocket-specific API shape from the active contract.

### AI / Knowledge Base / Specialist Routing

The active runtime pipeline remains:

1. `Coordinator`
2. `Knowledge Search`
3. `Response`

#### Coordinator

Responsibilities:

- interpret the user message and short conversation context;
- decide the conversation mode;
- request clarification only when needed;
- decide whether specialist routing is needed.

Coordinator output mode enum:

- `answer`
- `clarify`
- `partial_with_specialist`
- `route_to_specialist`

#### Knowledge Search

Responsibilities:

- search only the accreditation knowledge base;
- return matched knowledge items;
- return answerability and coverage metadata;
- never fabricate missing information.

Search result coverage enum:

- `full`
- `partial`
- `none`

#### Response

Responsibilities:

- produce the final user-facing answer for MAX messenger;
- keep wording simple, short, and non-technical;
- incorporate clarification questions when mode is `clarify`;
- include specialist information when mode is `partial_with_specialist` or `route_to_specialist`.

The response layer must not:

- use the old real-estate persona;
- mention ЖК “Мыс”, MR Group, Андрей, or sales scenarios;
- generate widget-specific visuals, site actions, or property cards;
- output speculative content.

### Service Endpoints

Only keep HTTP endpoints needed for service operations, such as:

- `health`
- knowledge-base refresh / search-base maintenance
- feedback intake

Do not keep public widget-facing chat endpoints or settings APIs.

## Specialist Catalog

The specialist catalog is a local JSON asset:

- `resources/knowledge-base/specialists/ru.json`

Schema:

```json
{
  "specialists": [
    {
      "id": "accreditation-main",
      "fullName": "Иванов Иван Иванович",
      "position": "Специалист по аккредитации",
      "contact": "@ivanov",
      "topics": ["аккредитация", "статус заявки", "ошибка в документах"],
      "isDefault": true
    }
  ]
}
```

Selection rules:

- the model may suggest routing by topic;
- final response includes specialist information from the catalog only;
- no contact may be invented outside the JSON file;
- if several specialists match, prefer the one with the strongest topic overlap;
- if no specialist matches strongly, use the default accreditation specialist.

## Data Contract

The final response contract must explicitly support:

```ts
type AssistantMode =
  | 'answer'
  | 'clarify'
  | 'partial_with_specialist'
  | 'route_to_specialist';

interface SpecialistInfo {
  fullName: string;
  position: string;
  contact: string;
  reason: string;
}

interface AssistantReply {
  mode: AssistantMode;
  message: string;
  clarificationQuestions?: string[];
  specialist?: SpecialistInfo;
}
```

Rules:

- `message` is always present;
- `clarificationQuestions` is present only in `clarify`;
- `specialist` is present only in specialist-routing modes;
- `reason` briefly explains why this specialist is relevant.

## Controlled Cutover Strategy

The migration uses a controlled cutover rather than a single destructive rewrite.

### Phase 1: lock the product behavior

Status: already implemented.

- narrow the AI runtime to knowledge-base answering plus specialist routing;
- add explicit reply modes;
- add specialist catalog support;
- remove old fast-path persona behavior from the active flow.

### Phase 2: introduce MAX transport alongside the old transport

Status: not started.

- add MAX webhook controller and MAX bot API client;
- add MAX update normalization into the messaging domain;
- keep the old widget transport only long enough to avoid breaking the build during the switch.

### Phase 3: switch the active runtime to MAX

Status: not started.

- wire the application bootstrap and messaging module around MAX transport;
- ensure the message-processing service uses MAX as the only runtime adapter;
- verify the end-to-end path from MAX webhook to MAX outbound reply.

### Phase 4: remove obsolete code

Status: not started.

Delete or stop wiring:

- widget messaging controllers and websocket docs;
- `MessagingGateway`;
- `WebAdapterService`;
- TTS and speech recognition services and controllers;
- site-action runner and site assistant transport helpers;
- `site-assistant-elements` integration controller and related AI site-assistant code;
- widget settings, site assistant settings, and generic integration settings controllers;
- `src/domain/settings` if no remaining code depends on it;
- locale update flows that only exist for the widget/settings model.

### Phase 5: keep only supported service endpoints

Status: not started.

- retain `health`;
- retain knowledge-base refresh operations;
- retain feedback endpoints;
- drop or decommission the rest of the widget-facing and settings-oriented endpoints.

## Removal Scope

The following code families are expected to leave the active product and likely be deleted entirely:

- `src/domain/ai/agents/site-assistant/**`
- `src/domain/messaging/controller/messaging.controller.ts`
- `src/domain/messaging/controller/messaging-websocket-docs.controller.ts`
- `src/domain/messaging/controller/messaging.getaway.ts`
- `src/domain/messaging/controller/tts.controller.ts`
- `src/domain/messaging/services/web.service.ts`
- `src/domain/messaging/services/site-action-runner.service.ts`
- `src/domain/messaging/services/speech-recognition.service.ts`
- `src/domain/messaging/services/speech-synthesis.service.ts`
- `src/domain/settings/**`
- `src/infrastructure/integration/controller/integration-settings.controller.ts`
- `src/infrastructure/integration/controller/site-assistant-elements.controller.ts`
- `src/infrastructure/integration/controller/site-assistant-settings.controller.ts`
- `src/infrastructure/integration/controller/widget-settings.controller.ts`

Some locale support code may remain if it is still required by shared text rendering, but locale mutation through widget/settings APIs is out of scope and should be removed.

## Error Handling

- If MAX sends an unsupported update type, acknowledge it safely without invoking the AI pipeline.
- If the knowledge base has no reliable answer, do not fabricate one; route to a specialist.
- If the specialist catalog cannot load, fail closed with a generic internal error path rather than inventing contact data.
- If outbound delivery to MAX fails, log the failure with enough transport metadata for retry or diagnostics.
- If a service endpoint remains available, it must not depend on removed widget or site-assistant code paths.

## Testing

Add or preserve coverage for:

- coordinator mode selection;
- search coverage detection;
- response formatting for all four modes;
- specialist selection from the local JSON catalog;
- MAX update normalization;
- MAX outbound message mapping;
- webhook validation and rejection of malformed updates;
- end-to-end webhook -> message processing -> AI reply -> MAX send flow;
- absence of old widget/site-assistant/settings controllers from active modules.

## Success Criteria

The redesign is complete when:

- a MAX webhook update can enter the system and produce a MAX reply through the narrowed AI pipeline;
- the assistant only answers from the knowledge base, asks clarifications, or routes to a specialist;
- specialist contacts come only from the local JSON catalog;
- no widget/websocket/TTS/site-assistant/settings runtime path remains in active application modules;
- only the required service endpoints remain exposed.
