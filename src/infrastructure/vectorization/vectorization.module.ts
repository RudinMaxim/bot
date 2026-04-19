import { Module } from '@nestjs/common';
import {
    TextProcessorService,
    VectorizationService,
} from './service';
import {
    OllamaEmbeddingProvider,
    WeaviateVectorStore,
} from './common/providers';
import { ConfigModule } from '../config';

@Module({
    imports: [ConfigModule],
    providers: [
        OllamaEmbeddingProvider,
        WeaviateVectorStore,
        TextProcessorService,
        VectorizationService,
    ],
    exports: [VectorizationService, TextProcessorService],
})
export class VectorizationModule {}
