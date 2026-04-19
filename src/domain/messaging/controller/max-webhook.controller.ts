import {
    Body,
    Controller,
    Headers,
    Post,
    UnauthorizedException,
    Version,
} from '@nestjs/common';
import { SecretsConfig } from 'src/infrastructure/config/interfaces';
import { MessageService } from '../services/message.service';
import { MaxAdapterService } from '../services/max-adapter.service';
import { MaxBotApiService } from '../services/max-bot-api.service';
import { MaxUpdate } from '../common/types/max.types';

@Controller('max')
export class MaxWebhookController {
    constructor(
        private readonly adapter: MaxAdapterService,
        private readonly messageService: MessageService,
        private readonly maxBotApiService: MaxBotApiService,
        private readonly secretsConfig: SecretsConfig,
    ) {}

    @Post('webhook')
    @Version('1')
    async handle(
        @Headers('x-max-secret') secret: string | undefined,
        @Body() update: MaxUpdate,
    ): Promise<{ ok: true }> {
        if (secret !== this.secretsConfig.max.webhookSecret) {
            throw new UnauthorizedException();
        }

        const message = this.adapter.normalizeUpdate(update);
        if (!message) {
            return { ok: true };
        }

        const processed = await this.messageService.handleMessage(message);
        await this.maxBotApiService.sendMessage({
            chatId: message.chatId,
            content: processed.response,
            replyToMessageId: message.messageId,
        });

        return { ok: true };
    }
}
