import { IncomingMessage, OutgoingMessage } from './message.types';

export abstract class IMessagingAdapter {
    abstract readonly platform: string;
    abstract sendMessage(message: OutgoingMessage): Promise<string>;
    abstract onMessage(
        callback: (message: IncomingMessage) => Promise<void>,
    ): void;
    abstract shutdown(): Promise<void>;
}

export interface IMessagingAdapterFactory {
    createAdapter(platform: string): IMessagingAdapter;
}
