export const SERVER_CONTRACT = {
    apiPrefix: '/api',
    apiVersion: 'v1',
    endpoints: {
        integration: {
            feedback: '/api/v1/integration/feedback',
            searchBaseRefresh: '/api/v1/integration/search-base/refresh',
        },
        max: {
            webhook: '/api/v1/max/webhook',
        },
    },
    headers: {
        apiKey: 'X-Api-Key',
        requestId: 'X-Request-Id',
    },
} as const;

export type ServerContract = typeof SERVER_CONTRACT;
