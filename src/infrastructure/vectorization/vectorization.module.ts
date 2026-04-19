import { Module } from '@nestjs/common';
import {
    TextProcessorService,
    VectorizationService,
} from './service';
import {
    OllamaEmbeddingProvider,
    WeaviateElementVectorStore,
    WeaviateVectorStore,
} from './common/providers';
import { ElementVectorizationService } from './service/element-vectorization.service';
import { ConfigModule } from '../config';

@Module({
    imports: [ConfigModule],
    providers: [
        OllamaEmbeddingProvider,
        WeaviateElementVectorStore,
        WeaviateVectorStore,
        TextProcessorService,
        ElementVectorizationService,
        VectorizationService,
    ],
    exports: [
        VectorizationService,
        ElementVectorizationService,
        TextProcessorService,
    ],
})
export class VectorizationModule {}
