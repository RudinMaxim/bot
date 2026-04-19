import { Module } from '@nestjs/common';
import { AiModule } from '../ai';
import { MaxWebhookController } from './controller';
import {
    MessageCacheRepository,
} from './repository';
import {
    MessageService,
    MaxAdapterService,
    MaxBotApiService,
} from './services';
import { ConfigModule } from 'src/infrastructure/config';

@Module({
    imports: [ConfigModule, AiModule],
    providers: [
        MessageService,
        MaxAdapterService,
        MaxBotApiService,
        MessageCacheRepository,
    ],
    controllers: [MaxWebhookController],
    exports: [MessageService, MaxAdapterService, MaxBotApiService],
})
export class MessagingModule {}
