import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { EmbeddingProvider } from '../types/vectorization.types';
import { SecretsConfig } from '../../../config/interfaces/secrets.interface';
import { OllamaApiResponse, OllamaEmbeddingResponse } from '../types/api.types';
import { sleep } from 'src/shared/utils';
import { RedisService } from 'src/infrastructure/redis/redis.config';

const EMBEDDING_CACHE_PREFIX = 'emb:';
const EMBEDDING_CACHE_TTL = 86400; // 24h

@Injectable()
export class OllamaEmbeddingProvider implements EmbeddingProvider {
    private readonly logger = new Logger(OllamaEmbeddingProvider.name);
    private activeSingleRequests = 0;
    private activeBatchRequests = 0;

    constructor(
        private readonly config: SecretsConfig,
        @Optional() private readonly redis?: RedisService,
    ) {}

    async generateEmbedding(
        text: string,
        options?: { signal?: AbortSignal; source?: string },
    ): Promise<number[]> {
        if (!text?.trim()) {
            throw new Error('Text cannot be empty');
        }

        const trimmed = text.trim();
        const cached = await this.getCachedEmbedding(trimmed);
        if (cached) {
            return cached;
        }
        const startedAt = Date.now();
        const source = options?.source || 'unspecified';
        this.activeSingleRequests += 1;
        this.logger.log({
            event: 'ollama_embedding_start',
            mode: 'single',
            source,
            model: this.config.embedding.vectorizationModel,
            textLength: trimmed.length,
            activeSingleRequests: this.activeSingleRequests,
            activeBatchRequests: this.activeBatchRequests,
        });

        try {
            this.throwIfAborted(options?.signal);
            this.logger.debug(
                `Generating embedding: "${trimmed.substring(0, 50)}..."`,
            );

            const response = await this.makeRequest(trimmed, options?.signal);
            const embedding = this.validateResponse(response);

            const result = this.config.embedding.vectorizationNormalize
                ? this.normalizeVector(embedding)
                : embedding;

            this.cacheEmbedding(trimmed, result);
            this.logger.log({
                event: 'ollama_embedding_done',
                mode: 'single',
                source,
                model: this.config.embedding.vectorizationModel,
                textLength: trimmed.length,
                dimensions: result.length,
                durationMs: Date.now() - startedAt,
                activeSingleRequests: this.activeSingleRequests,
                activeBatchRequests: this.activeBatchRequests,
            });

            return result;
        } catch (error) {
            this.logger.warn({
                event: 'ollama_embedding_failed',
                mode: 'single',
                source,
                model: this.config.embedding.vectorizationModel,
                textLength: trimmed.length,
                durationMs: Date.now() - startedAt,
                error: error instanceof Error ? error.message : String(error),
                activeSingleRequests: this.activeSingleRequests,
                activeBatchRequests: this.activeBatchRequests,
            });
            throw this.handleError(error);
        } finally {
            this.activeSingleRequests = Math.max(
                0,
                this.activeSingleRequests - 1,
            );
        }
    }

    private embeddingCacheKey(text: string): string {
        const hash = createHash('sha256')
            .update(text)
            .digest('hex')
            .slice(0, 32);
        return `${EMBEDDING_CACHE_PREFIX}${hash}`;
    }

    private async getCachedEmbedding(text: string): Promise<number[] | null> {
        if (!this.redis) return null;
        try {
            const raw = await this.redis.get<string>(
                this.embeddingCacheKey(text),
            );
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    this.logger.debug('Embedding cache hit');
                    return parsed;
                }
            }
        } catch {
            // cache miss on error — fall through
        }
        return null;
    }

    private cacheEmbedding(text: string, embedding: number[]): void {
        if (!this.redis) return;
        this.redis
            .set(
                this.embeddingCacheKey(text),
                JSON.stringify(embedding),
                EMBEDDING_CACHE_TTL,
            )
            .catch(() => {
                // fire-and-forget, ignore cache write errors
            });
    }

    async generateBatchEmbeddings(
        texts: string[],
        options?: { signal?: AbortSignal; source?: string },
    ): Promise<number[][]> {
        if (!texts?.length) {
            throw new Error('Texts array cannot be empty');
        }

        const embeddings = new Array<number[]>(texts.length);
        const batchSize = this.config.embedding.vectorizationBatchSize;

        for (let i = 0; i < texts.length; i += batchSize) {
            this.throwIfAborted(options?.signal);
            const batch = texts.slice(i, i + batchSize);
            const batchResults = await this.generateBatchEmbeddingsChunk(
                batch,
                options,
            );

            for (const [index, embedding] of batchResults.entries()) {
                embeddings[i + index] = embedding;
            }

            this.logger.debug(
                `Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)} processed`,
            );
        }

        this.logger.log(`Generated ${embeddings.length} embeddings`);
        return embeddings;
    }

    private async generateBatchEmbeddingsChunk(
        texts: string[],
        options?: { signal?: AbortSignal; source?: string },
    ): Promise<number[][]> {
        const startedAt = Date.now();
        const source = options?.source || 'unspecified';
        const results = new Array<number[]>(texts.length);
        const misses: string[] = [];
        const missIndexes: number[] = [];

        for (const [index, text] of texts.entries()) {
            const trimmed = text.trim();
            const cached = await this.getCachedEmbedding(trimmed);
            if (cached) {
                results[index] = cached;
                continue;
            }

            misses.push(trimmed);
            missIndexes.push(index);
        }

        if (misses.length > 0) {
            this.activeBatchRequests += 1;
            this.logger.log({
                event: 'ollama_embedding_start',
                mode: 'batch',
                source,
                model: this.config.embedding.vectorizationModel,
                requested: texts.length,
                generated: misses.length,
                cacheHits: texts.length - misses.length,
                activeSingleRequests: this.activeSingleRequests,
                activeBatchRequests: this.activeBatchRequests,
            });
            let generated: number[][];
            try {
                generated = await this.makeBatchRequest(
                    misses,
                    options?.signal,
                );
            } catch (error) {
                this.logger.warn({
                    event: 'ollama_embedding_failed',
                    mode: 'batch',
                    source,
                    model: this.config.embedding.vectorizationModel,
                    requested: texts.length,
                    generated: misses.length,
                    durationMs: Date.now() - startedAt,
                    error:
                        error instanceof Error ? error.message : String(error),
                    activeSingleRequests: this.activeSingleRequests,
                    activeBatchRequests: this.activeBatchRequests,
                });
                throw error;
            } finally {
                this.activeBatchRequests = Math.max(
                    0,
                    this.activeBatchRequests - 1,
                );
            }
            if (generated.length !== misses.length) {
                throw new Error(
                    `Invalid batch embedding response from Ollama: expected ${misses.length}, received ${generated.length}`,
                );
            }

            generated.forEach((embedding, index) => {
                const normalized = this.config.embedding.vectorizationNormalize
                    ? this.normalizeVector(embedding)
                    : embedding;
                const targetIndex = missIndexes[index];
                results[targetIndex] = normalized;
                this.cacheEmbedding(misses[index], normalized);
            });
        }

        const resolved = results.filter((item) => Array.isArray(item));
        this.logger.log({
            event: 'ollama_embedding_done',
            mode: 'batch',
            source,
            model: this.config.embedding.vectorizationModel,
            requested: texts.length,
            cacheHits: texts.length - misses.length,
            generated: misses.length,
            dimensions: resolved[0]?.length ?? 0,
            durationMs: Date.now() - startedAt,
            activeSingleRequests: this.activeSingleRequests,
            activeBatchRequests: this.activeBatchRequests,
        });

        return results;
    }

    async getModelInfo(): Promise<{ name: string; dimensions: number }> {
        return {
            name: this.config.embedding.vectorizationModel,
            dimensions: 384,
        };
    }

    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.fetchWithTimeout(
                `${this.config.embedding.vectorizationUrl}/api/tags`,
                { method: 'GET' },
                5000,
            );
            return response.ok;
        } catch {
            return false;
        }
    }

    private async makeRequest(
        text: string,
        signal?: AbortSignal,
    ): Promise<OllamaApiResponse> {
        let lastError: Error;

        for (
            let attempt = 1;
            attempt <= this.config.embedding.vectorizationMaxRetries;
            attempt++
        ) {
            try {
                this.throwIfAborted(signal);
                return await this.fetchJson<OllamaApiResponse>(
                    `${this.config.embedding.vectorizationUrl}/api/embed`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: this.config.embedding.vectorizationModel,
                            input: text,
                            keep_alive: -1,
                        }),
                    },
                    this.config.embedding.vectorizationTimeout,
                    signal,
                );
            } catch (error) {
                const errorMessage = this.formatErrorMessage(error);
                lastError =
                    error instanceof Error ? error : new Error(errorMessage);

                if (signal?.aborted || errorMessage === 'cancelled') {
                    throw this.createCancelledError();
                }

                if (attempt < this.config.embedding.vectorizationMaxRetries) {
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    this.logger.warn(
                        `Attempt ${attempt} failed, retrying in ${delay}ms: ${errorMessage}`,
                    );
                    await this.sleepWithAbort(delay, signal);
                }
            }
        }

        throw lastError!;
    }

    private async makeBatchRequest(
        texts: string[],
        signal?: AbortSignal,
    ): Promise<number[][]> {
        let lastError: Error;

        for (
            let attempt = 1;
            attempt <= this.config.embedding.vectorizationMaxRetries;
            attempt++
        ) {
            try {
                this.throwIfAborted(signal);
                const response = await this.fetchJson<OllamaApiResponse>(
                    `${this.config.embedding.vectorizationUrl}/api/embed`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: this.config.embedding.vectorizationModel,
                            input: texts,
                            keep_alive: -1,
                        }),
                    },
                    this.config.embedding.vectorizationTimeout,
                    signal,
                );

                return this.validateBatchResponse(response);
            } catch (error) {
                const errorMessage = this.formatErrorMessage(error);
                lastError =
                    error instanceof Error ? error : new Error(errorMessage);

                if (signal?.aborted || errorMessage === 'cancelled') {
                    throw this.createCancelledError();
                }

                if (attempt < this.config.embedding.vectorizationMaxRetries) {
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    this.logger.warn(
                        `Batch attempt ${attempt} failed, retrying in ${delay}ms: ${errorMessage}`,
                    );
                    await this.sleepWithAbort(delay, signal);
                }
            }
        }

        throw lastError!;
    }

    private async fetchJson<T>(
        url: string,
        init: RequestInit,
        timeoutMs: number,
        signal?: AbortSignal,
    ): Promise<T> {
        const response = await this.fetchWithTimeout(
            url,
            init,
            timeoutMs,
            signal,
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return (await response.json()) as T;
    }

    private async fetchWithTimeout(
        url: string,
        init: RequestInit,
        timeoutMs: number,
        signal?: AbortSignal,
    ): Promise<Response> {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

        const onAbort = () => controller.abort();
        if (signal) {
            if (signal.aborted) {
                clearTimeout(timeoutHandle);
                throw this.createCancelledError();
            }
            signal.addEventListener('abort', onAbort, { once: true });
        }

        try {
            return await fetch(url, {
                ...init,
                signal: controller.signal,
            });
        } catch (error) {
            if (signal?.aborted) {
                throw this.createCancelledError();
            }
            throw error;
        } finally {
            clearTimeout(timeoutHandle);
            if (signal) {
                signal.removeEventListener('abort', onAbort);
            }
        }
    }

    private validateResponse(response: OllamaApiResponse): number[] {
        const data = this.unwrapResponse(response);
        const embedding = this.extractEmbedding(data);

        if (!embedding || !Array.isArray(embedding)) {
            throw new Error('Invalid embedding response from Ollama');
        }

        if (embedding.length === 0) {
            throw new Error('Empty embedding received from Ollama');
        }

        return embedding;
    }

    private validateBatchResponse(response: OllamaApiResponse): number[][] {
        const data = this.unwrapResponse(response);
        if (
            !Array.isArray(data.embeddings) ||
            data.embeddings.some(
                (item) => !Array.isArray(item) || item.length === 0,
            )
        ) {
            throw new Error('Invalid batch embedding response from Ollama');
        }

        return data.embeddings;
    }

    private unwrapResponse(
        response: OllamaApiResponse,
    ): OllamaEmbeddingResponse {
        if (
            response &&
            typeof response === 'object' &&
            'data' in response &&
            response.data
        ) {
            return response.data;
        }
        return response as OllamaEmbeddingResponse;
    }

    private extractEmbedding(
        response: OllamaEmbeddingResponse,
    ): number[] | undefined {
        if (Array.isArray(response.embedding)) {
            return response.embedding;
        }
        if (
            Array.isArray(response.embeddings) &&
            Array.isArray(response.embeddings[0])
        ) {
            return response.embeddings[0];
        }
        return undefined;
    }

    private handleError(error: unknown): Error {
        const details = this.getErrorDetails(error);
        const message = details.message;
        const messageLower = message.toLowerCase();
        const causeLower = (details.causeMessage || '').toLowerCase();
        const endpoint = this.config.embedding.vectorizationUrl;
        const connectionCodes = new Set([
            'ECONNREFUSED',
            'ENOTFOUND',
            'EAI_AGAIN',
            'ECONNRESET',
            'ETIMEDOUT',
            'EACCES',
            'EPERM',
        ]);

        if (message === 'cancelled') {
            return error instanceof Error ? error : new Error('cancelled');
        }

        if (
            details.name === 'AbortError' ||
            messageLower.includes('timeout') ||
            causeLower.includes('timeout')
        ) {
            return new Error(
                'Ollama request timed out. Ensure the service is responsive.',
            );
        }

        if (
            (details.code && connectionCodes.has(details.code)) ||
            messageLower.includes('econnrefused') ||
            messageLower.includes('enotfound') ||
            messageLower.includes('eai_again') ||
            messageLower.includes('econnreset') ||
            messageLower.includes('eacces') ||
            messageLower.includes('eperm') ||
            causeLower.includes('econnrefused') ||
            causeLower.includes('enotfound') ||
            causeLower.includes('eai_again') ||
            causeLower.includes('econnreset') ||
            causeLower.includes('eacces') ||
            causeLower.includes('eperm')
        ) {
            if (
                details.code === 'EACCES' ||
                details.code === 'EPERM' ||
                messageLower.includes('eacces') ||
                messageLower.includes('eperm') ||
                causeLower.includes('eacces') ||
                causeLower.includes('eperm')
            ) {
                return new Error(
                    `Ollama connection blocked for ${endpoint}. Check firewall/network policy and EMBEDDING_VECTORIZATION_URL.`,
                );
            }
            return new Error(
                `Ollama service unavailable at ${endpoint}. Ensure Ollama is running and reachable.`,
            );
        }

        const formatted = this.formatErrorMessage(error);
        this.logger.error(`Embedding generation failed: ${formatted}`);
        return new Error(`Failed to generate embedding: ${formatted}`);
    }

    private getErrorDetails(error: unknown): {
        message: string;
        name?: string;
        code?: string;
        causeMessage?: string;
    } {
        if (error instanceof Error) {
            const cause = (error as { cause?: unknown }).cause;
            let code: string | undefined;
            let causeMessage: string | undefined;

            if (cause && typeof cause === 'object') {
                const typedCause = cause as {
                    code?: unknown;
                    message?: unknown;
                };
                if (typeof typedCause.code === 'string') {
                    code = typedCause.code;
                }
                if (typeof typedCause.message === 'string') {
                    causeMessage = typedCause.message;
                }
            } else if (typeof cause === 'string') {
                causeMessage = cause;
            }

            return {
                message: error.message || 'Unknown error',
                name: error.name,
                code,
                causeMessage,
            };
        }

        return { message: String(error) };
    }

    private formatErrorMessage(error: unknown): string {
        const details = this.getErrorDetails(error);
        if (details.causeMessage && details.message !== details.causeMessage) {
            return `${details.message} (${details.causeMessage})`;
        }
        if (details.code && !details.message.includes(details.code)) {
            return `${details.message} (${details.code})`;
        }
        return details.message;
    }

    private normalizeVector(vector: number[]): number[] {
        const magnitude = Math.sqrt(
            vector.reduce((sum, val) => sum + val * val, 0),
        );

        return magnitude === 0
            ? vector.slice()
            : vector.map((x) => x / magnitude);
    }

    private createCancelledError(): Error {
        return Object.assign(new Error('cancelled'), { code: 'CANCELLED' });
    }

    private throwIfAborted(signal?: AbortSignal): void {
        if (signal?.aborted) {
            throw this.createCancelledError();
        }
    }

    private async sleepWithAbort(
        ms: number,
        signal?: AbortSignal,
    ): Promise<void> {
        if (!signal) {
            await sleep(ms);
            return;
        }

        if (signal.aborted) {
            throw this.createCancelledError();
        }

        await new Promise<void>((resolve, reject) => {
            const cleanup = () => signal.removeEventListener('abort', onAbort);

            const timeoutHandle = setTimeout(() => {
                cleanup();
                resolve();
            }, ms);

            const onAbort = () => {
                clearTimeout(timeoutHandle);
                reject(this.createCancelledError());
            };

            signal.addEventListener('abort', onAbort, { once: true });
        });
    }
}
