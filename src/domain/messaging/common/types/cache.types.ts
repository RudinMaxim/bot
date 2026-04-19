import { QuickReply } from 'src/domain/ai/agents';
import { MessageMetadata } from './message.types';

export interface CachedMessageData {
    readonly request: string;
    readonly response: string;
    readonly quickReplies?: QuickReply[];
    readonly metadata: MessageMetadata;
    readonly feedbackValue?: number;
    readonly feedbackTimestamp?: string;
}
