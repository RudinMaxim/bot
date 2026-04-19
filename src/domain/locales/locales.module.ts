import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from 'src/infrastructure/config';
import { WidgetLocaleEntity } from 'src/infrastructure/persistence/typeorm/entities';
import { LocalesService } from './services';
import { LocalesCacheRepository, LocalesStoreRepository } from './repository';

@Module({
    imports: [ConfigModule, TypeOrmModule.forFeature([WidgetLocaleEntity])],
    providers: [LocalesService, LocalesCacheRepository, LocalesStoreRepository],
    exports: [LocalesService],
})
export class LocalesModule {}
