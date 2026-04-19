import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from 'src/infrastructure/config';
import { SearchBaseCatalogEntity } from 'src/infrastructure/persistence/typeorm/entities';
import { VectorizationModule } from 'src/infrastructure/vectorization';
import { SearchBaseCatalogRepository } from './repository';
import {
    SearchBaseRefreshService,
    SearchBaseService,
    EmbeddingService,
} from './services';

@Module({
    imports: [
        ConfigModule,
        VectorizationModule,
        TypeOrmModule.forFeature([SearchBaseCatalogEntity]),
    ],
    providers: [
        SearchBaseCatalogRepository,
        SearchBaseService,
        SearchBaseRefreshService,
        EmbeddingService,
    ],
    exports: [
        SearchBaseCatalogRepository,
        SearchBaseService,
        SearchBaseRefreshService,
        EmbeddingService,
    ],
})
export class SearchBaseModule {}
