import { Injectable } from '@nestjs/common';
import { IncomingMessage, MessageType } from '../common/types';
import { MaxUpdate } from '../common/types/max.types';

@Injectable()
export class MaxAdapterService {
    normalizeUpdate(update: MaxUpdate): IncomingMessage | null {
        const message = update.message;
        if (!message?.text) {
            return null;
        }

        const timestamp = new Date(message.timestamp * 1000);

        return {
            messageId: message.message_id,
            chatId: message.chat.chat_id,
            userId: message.from.user_id,
            username: message.from.username,
            type: MessageType.TEXT,
            content: message.text,
            timestamp,
            metadata: {
                platform: 'max',
                chatId: message.chat.chat_id,
                messageId: message.message_id,
                inputType: MessageType.TEXT,
                sessionId: message.chat.chat_id,
                userId: message.from.user_id,
                timestamp: timestamp.toISOString(),
            },
        };
    }
}
