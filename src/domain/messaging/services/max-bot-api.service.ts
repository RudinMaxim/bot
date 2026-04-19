import { Injectable } from '@nestjs/common';
import { OutgoingMessage } from '../common/types';
import { SecretsConfig } from 'src/infrastructure/config/interfaces';

@Injectable()
export class MaxBotApiService {
    constructor(private readonly secretsConfig: SecretsConfig) {}

    async sendMessage(message: OutgoingMessage): Promise<string> {
        const response = await fetch(
            `${this.secretsConfig.max.apiBaseUrl}/messages`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.secretsConfig.max.botToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: message.chatId,
                    text: message.content ?? '',
                    reply_to_message_id: message.replyToMessageId,
                }),
            },
        );

        if (!response.ok) {
            throw new Error(`MAX send failed with status ${response.status}`);
        }

        const payload = (await response.json()) as { message_id?: string };
        return String(payload.message_id ?? '');
    }
}
