export const SERVER_CONTRACT = {
    apiPrefix: '/api',
    apiVersion: 'v1',
    endpoints: {
        integration: {
            feedback: '/api/v1/integration/feedback',
            searchBaseRefresh: '/api/v1/integration/search-base/refresh',
        },
        messaging: {
            widgetScript: '/api/v1/messaging/widget.js',
            widgetStyles: '/api/v1/messaging/widget.css',
            session: '/api/v1/messaging/session',
            messages: '/api/v1/messaging/messages',
            clear: '/api/v1/messaging/clear',
        },
    },
    headers: {
        apiKey: 'X-Api-Key',
        requestId: 'X-Request-Id',
    },
} as const;

export type ServerContract = typeof SERVER_CONTRACT;
