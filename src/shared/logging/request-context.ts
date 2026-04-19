import { AsyncLocalStorage } from 'async_hooks';

type RequestContextStore = {
    requestId: string;
};

class RequestContext {
    private static readonly storage =
        new AsyncLocalStorage<RequestContextStore>();

    static run(requestId: string, fn: () => void): void {
        this.storage.run({ requestId }, fn);
    }

    static getRequestId(): string | undefined {
        return this.storage.getStore()?.requestId;
    }
}

export { RequestContext };
