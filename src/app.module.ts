import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { RedisModule } from './infrastructure/redis';
import { SwaggerModule } from './shared/swagger';
import { ConfigModule } from './infrastructure/config';
import { PostgresModule } from './infrastructure/postgres';
import { SecurityModule } from './shared/security';
import { HealthModule } from './shared/health';
import { AiModule } from './domain/ai';
import { SearchBaseModule } from './domain/search-base';
import { VectorizationModule } from './infrastructure/vectorization';
import { MessagingModule } from './domain/messaging';
import { LocalesModule } from './domain/locales';
import { TypeormPersistenceModule } from './infrastructure/persistence/typeorm/typeorm.module';

@Module({
    imports: [
        ConfigModule,
        PostgresModule,
        TypeormPersistenceModule,
        ScheduleModule.forRoot(),
        SecurityModule.forRoot(),
        SwaggerModule.forRoot(),
        TerminusModule,
        RedisModule,
        VectorizationModule,
        HealthModule,
        AiModule,
        SearchBaseModule,
        MessagingModule,
        LocalesModule,
    ],
    exports: [RedisModule, PostgresModule],
})
export class AppModule {}
