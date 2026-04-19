import {
    FeedbackCommand,
    IncomingMessage,
    ProcessedMessage,
} from './message.types';
import { MessageHistoryItem } from './message-history.types';
import type { PipelineCallbacks } from 'src/domain/ai/common/types';

export interface IMessageHandler {
    handleMessage(
        message: IncomingMessage,
        callbacks?: PipelineCallbacks,
    ): Promise<ProcessedMessage>;

    handleCommand(
        message: IncomingMessage,
        command: string,
    ): Promise<ProcessedMessage>;

    handleFeedback(feedback: FeedbackCommand): Promise<boolean>;

    getMessageHistory(
        chatId: string,
        limit?: number,
    ): Promise<MessageHistoryItem[]>;
}
