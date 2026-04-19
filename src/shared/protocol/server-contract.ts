/**
 * ============================================================================
 *  SERVER CONTRACT - single source of truth for the backend surface exposed
 *  to the browser widget.
 * ============================================================================
 *
 *  The shared monorepo package mirrors this contract for client-side usage.
 *  Backend Docker images intentionally build from the atomic `server/`
 *  service only, so backend runtime imports stay local to this service.
 */

export const SERVER_CONTRACT = {
    /** Socket.IO path (must match the path we pass to `new SocketIoServer`). */
    socketPath: '/chat',

    /** Global HTTP prefix set via `app.setGlobalPrefix('api')`. */
    apiPrefix: '/api',

    /** Default API version applied via `@Version('1')` on controller routes. */
    apiVersion: 'v1',

    /**
     * Absolute HTTP endpoints the widget calls, grouped by surface.
     *
     * - `system`: infrastructure that bootstraps the widget. Version-neutral
     *   on purpose (the widget can't know the API version before it has a
     *   session). Not part of the public integration API.
     * - `widget`: public read-only runtime surface the embedded widget consumes
     *   (locales today; theme/quick-replies tomorrow). Same versioning as the
     *   rest of the v1 surface, but no integration API key requirement.
     * - `messaging`: the chat surface itself (history, feedback, TTS).
     */
    endpoints: {
        system: {
            /** `GET` - public, version-neutral session bootstrap. */
            sessionBootstrap: '/api/session/bootstrap',
        },
        widget: {
            /** `GET` - aggregated locales list for widget i18n. */
            locales: '/api/v1/widget/locales',
            /** `GET` - single locale bundle, path param `:locale`. */
            localeByCode: '/api/v1/widget/locale',
        },
        messaging: {
            /** `GET` - historical messages for the current chat. */
            history: '/api/v1/messaging/history',
            /** `POST` - user feedback on a bot response. */
            feedback: '/api/v1/messaging/feedback',
            /** `POST` - text-to-speech synthesis (IdentityGuard-protected). */
            ttsSynthesis: '/api/v1/messaging/synthesis',
        },
    },

    /** HTTP header names the server recognises from the widget. */
    headers: {
        /** Integration API key (ApiKeyGuard). Canonical casing. */
        apiKey: 'X-Api-Key',
        /** Per-request correlation id, echoed in responses and logs. */
        requestId: 'X-Request-Id',
    },

    /**
     * Fields the backend reads from `socket.handshake.auth` during the
     * WebSocket handshake. Extend this list only when the server actually
     * consumes the field.
     */
    wsHandshakeAuth: {
        /** Short-lived JWT from `sessionBootstrap`. Promoted to Authorization header. */
        jwt: 'jwt',
    },
} as const;

export type ServerContract = typeof SERVER_CONTRACT;
