import { Injectable } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import type {
    SearchBaseDeletePayload,
    SearchBaseDeleteResult,
    SearchBaseItemDetails,
    SearchBaseSearchQuery,
    SearchBaseSearchResult,
    SearchBaseUpsertPayload,
    SearchBaseUpsertResult,
} from '../common/types';

@Injectable()
export class SearchBaseService {
    constructor(private readonly embeddingService: EmbeddingService) {}

    search(
        query: SearchBaseSearchQuery,
        options?: { preferOrder?: boolean },
    ): Promise<SearchBaseSearchResult> {
        return this.embeddingService.searchBase(query, options);
    }

    upsert(payload: SearchBaseUpsertPayload): Promise<SearchBaseUpsertResult> {
        return this.embeddingService.upsertSearchBase(payload);
    }

    getById(id: string, locale: string): Promise<SearchBaseItemDetails | null> {
        return this.embeddingService.getSearchBaseItem(id, locale);
    }

    move(id: string, locale: string, after: number) {
        return this.embeddingService.moveSearchBaseItem(id, locale, after);
    }

    deleteById(id: string, locale: string): Promise<boolean> {
        return this.embeddingService.deleteSearchBaseById(id, locale);
    }

    delete(payload: SearchBaseDeletePayload): Promise<SearchBaseDeleteResult> {
        return this.embeddingService.deleteSearchBase(payload);
    }
}
