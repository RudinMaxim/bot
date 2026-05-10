import { Module } from '@nestjs/common';
import { AiModule } from '../ai';
import { MessagingWidgetController } from './controller';
import {
    MessageCacheRepository,
} from './repository';
import {
    FollowUpResolverService,
    MessageService,
} from './services';
import { ConfigModule } from 'src/infrastructure/config';

@Module({
    imports: [ConfigModule, AiModule],
    providers: [
        MessageService,
        MessageCacheRepository,
        FollowUpResolverService,
    ],
    controllers: [MessagingWidgetController],
    exports: [MessageService],
})
export class MessagingModule {}
