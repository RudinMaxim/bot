/**
 * E2E Benchmark: AI Pipeline Performance
 *
 * Запускает 30 реальных вопросов через WebSocket (Socket.IO),
 * измеряет latency каждого шага и сохраняет отчёт в JSON/CSV.
 *
 * Запуск:
 *   npx jest --config test/e2e/jest-e2e.config.ts test/e2e/pipeline-benchmark.e2e-spec.ts
 *
 * Перед запуском:
 *   1. Поднять все сервисы (docker compose up -d)
 *   2. Приложение должно быть запущено (npm run dev или npm run start:prod)
 *   3. Настроить URL ниже если нужно
 */

import { io, Socket } from 'socket.io-client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ─── Configuration ──────────────────────────────────────────────────────────

const CONFIG = {
    /** URL WebSocket сервера */
    wsUrl: process.env.E2E_WS_URL || 'http://localhost:3000',
    /** Путь WebSocket */
    wsPath: process.env.E2E_WS_PATH || '/chat',
    /** Таймаут на один вопрос (мс) */
    questionTimeout: parseInt(process.env.E2E_TIMEOUT || '60000', 10),
    /** Пауза между вопросами (мс) — чтобы не перегружать */
    delayBetweenQuestions: parseInt(process.env.E2E_DELAY || '1000', 10),
    /** Locale */
    locale: process.env.E2E_LOCALE || 'ru',
    /** Имя бенчмарка для файла отчёта */
    benchmarkName: process.env.E2E_BENCHMARK_NAME || 'benchmark',
    /** Директория для отчётов */
    reportDir: path.resolve(__dirname, '..', '..', 'docs', 'benchmark-reports'),
};

// ─── Test Questions ─────────────────────────────────────────────────────────

interface TestQuestion {
    id: number;
    category: string;
    question: string;
    /** Ожидаемые ключевые слова в ответе (для проверки quality) */
    expectedKeywords?: string[];
    /** Ключевые слова, которых не должно быть в ответе */
    forbiddenKeywords?: string[];
}

const BASE_TEST_QUESTIONS: TestQuestion[] = [
    // --- Поиск квартир (Search Agent) ---
    {
        id: 1,
        category: 'search',
        question: 'Какие есть квартиры-студии?',
        expectedKeywords: ['студи'],
    },
    {
        id: 2,
        category: 'search',
        question: 'Покажи двухкомнатные квартиры',
        expectedKeywords: ['двухкомнат', '2-комнат'],
    },
    {
        id: 3,
        category: 'search',
        question: 'Есть ли квартиры на высоких этажах?',
        expectedKeywords: ['этаж'],
    },
    {
        id: 4,
        category: 'search',
        question: 'Квартиры с панорамными окнами',
        expectedKeywords: ['панорам', 'окн'],
    },
    {
        id: 5,
        category: 'search',
        question: 'Что есть в ценовом диапазоне до 10 миллионов?',
        expectedKeywords: ['цен', 'млн', 'миллион'],
    },

    // --- Аналитика / Подбор (Analytics Agent) ---
    {
        id: 6,
        category: 'analytics',
        question: 'Подбери мне квартиру для семьи с двумя детьми',
        expectedKeywords: ['комнат', 'семь'],
    },
    {
        id: 7,
        category: 'analytics',
        question: 'Сравни однокомнатные и двухкомнатные квартиры по цене',
        expectedKeywords: ['однокомнат', 'двухкомнат'],
    },
    {
        id: 8,
        category: 'analytics',
        question: 'Какая квартира лучше всего подходит для инвестиций?',
        expectedKeywords: ['инвестиц'],
    },
    {
        id: 9,
        category: 'analytics',
        question: 'Покажи самые большие квартиры по площади',
        expectedKeywords: ['площад', 'кв.м', 'м²'],
    },
    {
        id: 10,
        category: 'analytics',
        question: 'Какие есть варианты с отделкой?',
        expectedKeywords: ['отделк'],
    },

    // --- Контакт / Action Agent ---
    {
        id: 11,
        category: 'action',
        question: 'Хочу записаться на просмотр',
        expectedKeywords: ['просмотр', 'запис', 'контакт'],
    },
    {
        id: 12,
        category: 'action',
        question: 'Как связаться с менеджером?',
        expectedKeywords: ['менеджер', 'связ', 'контакт'],
    },
    {
        id: 13,
        category: 'action',
        question: 'Позвоните мне, пожалуйста',
        expectedKeywords: ['позвон', 'контакт', 'номер'],
    },
    {
        id: 14,
        category: 'action',
        question: 'Запишите меня на консультацию на завтра',
        expectedKeywords: ['консультац', 'запис'],
    },
    {
        id: 15,
        category: 'action',
        question: 'Меня зовут Алексей, мой телефон +7 999 123 4567',
        expectedKeywords: ['Алексей', 'контакт'],
    },

    // --- Общие вопросы / FAQ ---
    {
        id: 16,
        category: 'faq',
        question: 'Где находится жилой комплекс?',
        expectedKeywords: ['адрес', 'расположен', 'находит'],
    },
    {
        id: 17,
        category: 'faq',
        question: 'Какие условия ипотеки?',
        expectedKeywords: ['ипотек', 'кредит', 'банк'],
    },
    {
        id: 18,
        category: 'faq',
        question: 'Когда планируется сдача дома?',
        expectedKeywords: ['сдач', 'срок', 'готов'],
    },
    {
        id: 19,
        category: 'faq',
        question: 'Есть ли парковка?',
        expectedKeywords: ['парков', 'машиноместо', 'авто'],
    },
    {
        id: 20,
        category: 'faq',
        question: 'Какая инфраструктура рядом?',
        expectedKeywords: ['инфраструктур', 'рядом', 'школ', 'магазин'],
    },

    // --- Уточняющие / Follow-up ---
    {
        id: 21,
        category: 'followup',
        question: 'А подешевле есть?',
        expectedKeywords: ['цен', 'стоим', 'дешев'],
    },
    {
        id: 22,
        category: 'followup',
        question: 'Расскажи подробнее про эту квартиру',
        expectedKeywords: [],
    },
    {
        id: 23,
        category: 'followup',
        question: 'Какая планировка у этой квартиры?',
        expectedKeywords: ['планировк'],
    },
    {
        id: 24,
        category: 'followup',
        question: 'Сколько стоит квадратный метр?',
        expectedKeywords: ['стоим', 'цен', 'кв'],
    },
    {
        id: 25,
        category: 'followup',
        question: 'А на каком этаже это?',
        expectedKeywords: ['этаж'],
    },

    // --- Edge cases ---
    { id: 26, category: 'edge', question: 'Привет', expectedKeywords: [] },
    {
        id: 27,
        category: 'edge',
        question: 'Спасибо за помощь',
        expectedKeywords: [],
    },
    {
        id: 28,
        category: 'edge',
        question: 'Не понял, объясни ещё раз',
        expectedKeywords: [],
    },
    {
        id: 29,
        category: 'edge',
        question:
            'Мне нужна трёхкомнатная квартира с видом на парк, не дороже 15 миллионов, желательно не выше 10 этажа, с отделкой',
        expectedKeywords: ['квартир'],
    },
    {
        id: 30,
        category: 'edge',
        question: 'Что вы можете предложить?',
        expectedKeywords: [],
    },
];

const MYS_TEST_QUESTIONS: TestQuestion[] = [
    {
        id: 31,
        category: 'mys_supported',
        question: 'Какие форматы жилья есть в ЖК Мыс?',
        expectedKeywords: [
            'таунхаус',
            'коттедж',
            'клубн',
            'многоквартир',
        ],
    },
    {
        id: 32,
        category: 'mys_supported',
        question: 'Когда планируется сдача комплекса ЖК Мыс?',
        expectedKeywords: ['2028', 'iii квартал'],
    },
    {
        id: 33,
        category: 'mys_supported',
        question: 'Есть ли подземный паркинг в урбан-блоках?',
        expectedKeywords: ['подземного паркинга нет'],
    },
    {
        id: 34,
        category: 'mys_supported',
        question: 'Кто девелопер проекта ЖК Мыс?',
        expectedKeywords: ['mr group'],
    },
    {
        id: 35,
        category: 'mys_supported',
        question: 'Какое ближайшее метро к ЖК Мыс?',
        expectedKeywords: ['кокошкино'],
    },
    {
        id: 36,
        category: 'mys_supported',
        question: 'Какие есть условия trade-in в ЖК Мыс?',
        expectedKeywords: ['trade-in', '60 дней'],
    },
    {
        id: 37,
        category: 'mys_refusal',
        question: 'Сколько всего мест в наземном паркинге ЖК Мыс?',
        expectedKeywords: ['нет достоверной информации'],
        forbiddenKeywords: ['машиномест', 'мест в паркинге:'],
    },
    {
        id: 38,
        category: 'mys_refusal',
        question:
            'Какая ежемесячная стоимость услуг управляющей компании в ЖК Мыс?',
        expectedKeywords: ['нет достоверной информации'],
        forbiddenKeywords: ['руб', '₽', 'стоимость обслуживания'],
    },
    {
        id: 39,
        category: 'mys_refusal',
        question: 'Кто будет оператором детского клуба 880 метров?',
        expectedKeywords: ['нет достоверной информации'],
        forbiddenKeywords: ['оператором будет', 'управлять клубом будет'],
    },
    {
        id: 40,
        category: 'mys_refusal',
        question: 'Можно ли жить в ЖК Мыс с двумя собаками крупных пород?',
        expectedKeywords: ['нет достоверной информации'],
        forbiddenKeywords: ['можно', 'разрешено'],
    },
];

const TEST_QUESTIONS: TestQuestion[] = [
    ...BASE_TEST_QUESTIONS,
    ...MYS_TEST_QUESTIONS,
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface QuestionResult {
    id: number;
    category: string;
    question: string;
    /** Полный ответ */
    response: string;
    /** Время от отправки до получения 'message' event (мс) — замер на клиенте */
    totalLatencyMs: number;
    /** Серверный processingTimeMs из COMPLETED status (если доступен) */
    serverProcessingTimeMs: number | null;
    /** Время от отправки до PROCESSING status (мс) */
    ttfbProcessingMs: number | null;
    /** Время от отправки до первого progress с данными (мс) */
    ttfbDataMs: number | null;
    /** Длина ответа в символах */
    responseLength: number;
    /** Были ли quickReplies */
    hasQuickReplies: boolean;
    /** Были ли propertyCards */
    hasPropertyCards: boolean;
    /** Были ли visuals */
    hasVisuals: boolean;
    /** Совпали ли ожидаемые keywords */
    keywordsMatched: string[];
    keywordsMissed: string[];
    forbiddenKeywordsMatched: string[];
    /** Ошибка если была */
    error: string | null;
    /** Raw server metrics из COMPLETED progress event */
        serverMetrics: Record<string, unknown> | null;
}

interface BenchmarkReport {
    name: string;
    timestamp: string;
    config: typeof CONFIG;
    summary: {
        totalQuestions: number;
        successful: number;
        failed: number;
        avgLatencyMs: number;
        p50LatencyMs: number;
        p95LatencyMs: number;
        p99LatencyMs: number;
        minLatencyMs: number;
        maxLatencyMs: number;
        avgResponseLength: number;
        keywordAccuracy: number;
        avgTtfbProcessingMs: number | null;
        /** Серверный avg processing time (из COMPLETED event) */
        avgServerProcessingMs: number | null;
        /** Суммарные токены за весь бенчмарк (из серверных метрик) */
        totalInputTokens: number;
        totalOutputTokens: number;
        totalTokens: number;
        /** Суммарная стоимость USD */
        totalCostUsd: number;
        /** Средние токены на вопрос */
        avgInputTokensPerQuestion: number;
        avgOutputTokensPerQuestion: number;
        avgCostPerQuestion: number;
        /** LLM calls за весь бенчмарк */
        totalLlmCalls: number;
        byCategory: Record<
            string,
            { count: number; avgMs: number; p95Ms: number }
        >;
    };
    results: QuestionResult[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// ─── Socket.IO Client Wrapper ───────────────────────────────────────────────

class BenchmarkClient {
    private socket: Socket | null = null;

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socket = io(CONFIG.wsUrl, {
                path: CONFIG.wsPath,
                transports: ['websocket'],
                timeout: 10_000,
            });

            this.socket.on('connect', () => resolve());
            this.socket.on('connect_error', (err) =>
                reject(new Error(`Connection failed: ${err.message}`)),
            );

            setTimeout(() => reject(new Error('Connection timeout')), 10_000);
        });
    }

    joinRoom(chatId: string): void {
        this.socket?.emit('join', { body: { chatId } });
    }

    sendQuestion(
        chatId: string,
        question: string,
        username: string = 'benchmark-user',
    ): Promise<QuestionTimings> {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error('Socket not connected'));
                return;
            }

            const sentAt = Date.now();
            const timings: QuestionTimings = {
                sentAt,
                processingAt: null,
                dataAt: null,
                messageAt: null,
                response: null,
                completedPayload: null,
                error: null,
            };

            const timeout = setTimeout(() => {
                cleanup();
                timings.error = 'Timeout';
                resolve(timings);
            }, CONFIG.questionTimeout);

            const onProgress = (data: {
                body?: {
                    status?: string;
                    quickReplies?: unknown[];
                    visuals?: Array<{ type?: unknown; [key: string]: unknown }>;
                    chunk?: string;
                    quickRepliesPayload?: unknown[];
                    [key: string]: unknown;
                };
                metadata?: Record<string, unknown>;
            }) => {
                const status = data?.body?.status;
                if (status === 'processing' && !timings.processingAt) {
                    timings.processingAt = Date.now();
                }
                if (
                    !timings.dataAt &&
                    (data?.body?.visuals?.length ||
                        data?.body?.quickReplies?.length ||
                        typeof data?.body?.chunk === 'string')
                ) {
                    timings.dataAt = Date.now();
                }
                // COMPLETED progress event содержит серверные метрики
                if (status === 'completed') {
                    timings.completedPayload = (data?.body ?? null) as Record<
                        string,
                        unknown
                    > | null;
                    // Если message уже пришёл — можно resolve
                    if (timings.messageAt) {
                        cleanup();
                        resolve(timings);
                    }
                }
            };

            let messageReceived = false;

            const onMessage = (data: {
                body?: {
                    content?: string;
                    visuals?: Array<{ type?: unknown; [key: string]: unknown }>;
                    keyboard?: { buttons?: unknown[] };
                };
                metadata?: Record<string, unknown>;
            }) => {
                timings.messageAt = Date.now();
                timings.response = data;
                messageReceived = true;
                // Ждём COMPLETED progress для метрик (макс 3с после message)
                setTimeout(() => {
                    if (messageReceived) {
                        cleanup();
                        resolve(timings);
                    }
                }, 3000);
                // Если completed уже пришёл — resolve сразу
                if (timings.completedPayload) {
                    cleanup();
                    resolve(timings);
                }
            };

            const onError = (data: { message?: string }) => {
                cleanup();
                timings.error = data?.message || 'Unknown error';
                resolve(timings);
            };

            const cleanup = () => {
                clearTimeout(timeout);
                this.socket?.off('progress', onProgress);
                this.socket?.off('message', onMessage);
                this.socket?.off('error', onError);
            };

            this.socket.on('progress', onProgress);
            this.socket.on('message', onMessage);
            this.socket.on('error', onError);

            this.socket.emit('chat_message', {
                body: {
                    chatId,
                    content: question,
                    username,
                    type: 'text',
                },
                metadata: {
                    locale: CONFIG.locale,
                },
            });
        });
    }

    disconnect(): void {
        this.socket?.disconnect();
        this.socket = null;
    }
}

interface QuestionTimings {
    sentAt: number;
    processingAt: number | null;
    dataAt: number | null;
    messageAt: number | null;
    response: {
        body?: {
            content?: string;
            visuals?: Array<{ type?: unknown; [key: string]: unknown }>;
            keyboard?: { buttons?: unknown[] };
        };
        metadata?: Record<string, unknown>;
    } | null;
    /** Данные из COMPLETED progress event (серверные метрики) */
    completedPayload: Record<string, unknown> | null;
    error: string | null;
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Pipeline Benchmark', () => {
    let client: BenchmarkClient;
    const results: QuestionResult[] = [];
    const chatId = `bench-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
        client = new BenchmarkClient();
        try {
            await client.connect();
            client.joinRoom(chatId);
            // Дать время на join
            await sleep(500);
        } catch (err) {
            console.error(
                `\n\n  Failed to connect to ${CONFIG.wsUrl}${CONFIG.wsPath}\n` +
                    `  Make sure the app is running.\n\n`,
                err,
            );
            throw err;
        }
    }, 15_000);

    afterAll(async () => {
        client?.disconnect();

        // Генерируем отчёт
        if (results.length > 0) {
            const report = buildReport(results);
            saveReport(report);
            printSummary(report);
        }
    });

    // Создаём по одному тесту на каждый вопрос
    for (const q of TEST_QUESTIONS) {
        it(`[Q${String(q.id).padStart(2, '0')}][${q.category}] ${q.question.slice(0, 60)}`, async () => {
            // Пауза между вопросами
            if (q.id > 1) {
                await sleep(CONFIG.delayBetweenQuestions);
            }

            const timings = await client.sendQuestion(chatId, q.question);
            const result = buildQuestionResult(q, timings);
            results.push(result);

            // Тест считается пройденным если получен ответ
            if (result.error) {
                console.warn(`  [WARN] Q${q.id}: ${result.error}`);
            }

            expect(result.error).toBeNull();
            expect(result.totalLatencyMs).toBeGreaterThan(0);
            expect(result.responseLength).toBeGreaterThan(0);
            expect(result.forbiddenKeywordsMatched).toHaveLength(0);

            // Лог для наглядности
            const m = result.serverMetrics ?? {};
            const tokens = toNum(m.inputTokens) + toNum(m.outputTokens);
            const cost = toNum(m.totalCostUsd);
            console.log(
                `  Q${String(q.id).padStart(2, '0')} | ${result.totalLatencyMs}ms` +
                    `${result.serverProcessingTimeMs ? ` (server: ${result.serverProcessingTimeMs}ms)` : ''}` +
                    `${result.ttfbProcessingMs ? ` | TTFB: ${result.ttfbProcessingMs}ms` : ''}` +
                    ` | ${result.responseLength} chars` +
                    `${tokens ? ` | ${tokens} tok` : ''}` +
                    `${cost ? ` | $${cost.toFixed(4)}` : ''}` +
                    `${result.hasPropertyCards ? ' | cards' : ''}` +
                    `${result.hasQuickReplies ? ' | qr' : ''}` +
                    `${result.keywordsMissed.length ? ` | missed: ${result.keywordsMissed.join(',')}` : ''}` +
                    `${result.forbiddenKeywordsMatched.length ? ` | forbidden: ${result.forbiddenKeywordsMatched.join(',')}` : ''}`,
            );
        });
    }
});

// ─── Result Builders ────────────────────────────────────────────────────────

function buildQuestionResult(
    q: TestQuestion,
    timings: QuestionTimings,
): QuestionResult {
    const content = timings.response?.body?.content ?? '';
    const contentLower = content.toLowerCase();
    const keywords = q.expectedKeywords ?? [];

    const matched = keywords.filter((kw) =>
        contentLower.includes(kw.toLowerCase()),
    );
    const missed = keywords.filter(
        (kw) => !contentLower.includes(kw.toLowerCase()),
    );
    const forbiddenKeywords = q.forbiddenKeywords ?? [];
    const forbiddenMatched = forbiddenKeywords.filter((kw) =>
        contentLower.includes(kw.toLowerCase()),
    );

    const quickReplies = timings.response?.body?.keyboard?.buttons;
    const visuals = Array.isArray(timings.response?.body?.visuals)
        ? timings.response.body.visuals
        : [];

    // Серверные метрики из COMPLETED progress event → body.metrics
    const completed = timings.completedPayload ?? {};
    const serverMetrics = (completed.metrics ?? {}) as Record<string, unknown>;

    return {
        id: q.id,
        category: q.category,
        question: q.question,
        response: content,
        totalLatencyMs: timings.messageAt
            ? timings.messageAt - timings.sentAt
            : -1,
        serverProcessingTimeMs:
            typeof serverMetrics.processingTimeMs === 'number'
                ? serverMetrics.processingTimeMs
                : typeof serverMetrics.executionTime === 'number'
                  ? serverMetrics.executionTime
                  : null,
        ttfbProcessingMs: timings.processingAt
            ? timings.processingAt - timings.sentAt
            : null,
        ttfbDataMs: timings.dataAt ? timings.dataAt - timings.sentAt : null,
        responseLength: content.length,
        hasQuickReplies: Array.isArray(quickReplies) && quickReplies.length > 0,
        hasPropertyCards: visuals.some(
            (visual) => visual?.type === 'property_cards',
        ),
        hasVisuals: visuals.length > 0,
        keywordsMatched: matched,
        keywordsMissed: missed,
        forbiddenKeywordsMatched: forbiddenMatched,
        error: timings.error,
        serverMetrics:
            Object.keys(serverMetrics).length > 0 ? serverMetrics : null,
    };
}

function buildReport(results: QuestionResult[]): BenchmarkReport {
    const successful = results.filter((r) => !r.error);
    const latencies = successful
        .map((r) => r.totalLatencyMs)
        .sort((a, b) => a - b);
    const ttfbProcessing = successful
        .map((r) => r.ttfbProcessingMs)
        .filter((v): v is number => v !== null);

    const serverTimes = successful
        .map((r) => r.serverProcessingTimeMs)
        .filter((v): v is number => v !== null);

    const totalKeywords = results.reduce(
        (sum, r) => sum + r.keywordsMatched.length + r.keywordsMissed.length,
        0,
    );
    const matchedKeywords = results.reduce(
        (sum, r) => sum + r.keywordsMatched.length,
        0,
    );

    // Агрегация токенов и стоимости из серверных метрик
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;
    let totalLlmCalls = 0;
    for (const r of results) {
        const m = r.serverMetrics;
        if (!m) continue;
        totalInputTokens += toNum(m.inputTokens);
        totalOutputTokens += toNum(m.outputTokens);
        totalCostUsd += toNum(m.totalCostUsd);
        totalLlmCalls += toNum(m.llmCalls);
    }

    const n = successful.length || 1;

    // По категориям
    const byCategory: Record<
        string,
        { count: number; avgMs: number; p95Ms: number }
    > = {};
    for (const r of successful) {
        if (!byCategory[r.category]) {
            byCategory[r.category] = { count: 0, avgMs: 0, p95Ms: 0 };
        }
        byCategory[r.category].count += 1;
    }
    for (const cat of Object.keys(byCategory)) {
        const catLatencies = successful
            .filter((r) => r.category === cat)
            .map((r) => r.totalLatencyMs)
            .sort((a, b) => a - b);
        byCategory[cat].avgMs = Math.round(
            catLatencies.reduce((a, b) => a + b, 0) / catLatencies.length,
        );
        byCategory[cat].p95Ms = percentile(catLatencies, 95);
    }

    return {
        name: CONFIG.benchmarkName,
        timestamp: new Date().toISOString(),
        config: CONFIG,
        summary: {
            totalQuestions: results.length,
            successful: successful.length,
            failed: results.length - successful.length,
            avgLatencyMs: latencies.length
                ? Math.round(
                      latencies.reduce((a, b) => a + b, 0) / latencies.length,
                  )
                : 0,
            p50LatencyMs: percentile(latencies, 50),
            p95LatencyMs: percentile(latencies, 95),
            p99LatencyMs: percentile(latencies, 99),
            minLatencyMs: latencies[0] ?? 0,
            maxLatencyMs: latencies[latencies.length - 1] ?? 0,
            avgResponseLength: successful.length
                ? Math.round(
                      successful.reduce((s, r) => s + r.responseLength, 0) /
                          successful.length,
                  )
                : 0,
            keywordAccuracy:
                totalKeywords > 0
                    ? +(matchedKeywords / totalKeywords).toFixed(3)
                    : 1,
            avgTtfbProcessingMs: ttfbProcessing.length
                ? Math.round(
                      ttfbProcessing.reduce((a, b) => a + b, 0) /
                          ttfbProcessing.length,
                  )
                : null,
            avgServerProcessingMs: serverTimes.length
                ? Math.round(
                      serverTimes.reduce((a, b) => a + b, 0) /
                          serverTimes.length,
                  )
                : null,
            totalInputTokens,
            totalOutputTokens,
            totalTokens: totalInputTokens + totalOutputTokens,
            totalCostUsd: +totalCostUsd.toFixed(6),
            avgInputTokensPerQuestion: Math.round(totalInputTokens / n),
            avgOutputTokensPerQuestion: Math.round(totalOutputTokens / n),
            avgCostPerQuestion: +(totalCostUsd / n).toFixed(6),
            totalLlmCalls,
            byCategory,
        },
        results,
    };
}

function toNum(v: unknown): number {
    return typeof v === 'number' && isFinite(v) ? v : 0;
}

function saveReport(report: BenchmarkReport): void {
    ensureDir(CONFIG.reportDir);

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const baseName = `${report.name}_${ts}`;

    // JSON report
    const jsonPath = path.join(CONFIG.reportDir, `${baseName}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

    // CSV report
    const csvPath = path.join(CONFIG.reportDir, `${baseName}.csv`);
    const csvHeader = [
        'id',
        'category',
        'question',
        'total_latency_ms',
        'server_processing_ms',
        'ttfb_processing_ms',
        'ttfb_data_ms',
        'response_length',
        'has_quick_replies',
        'has_property_cards',
        'has_visuals',
        'keywords_matched',
        'keywords_missed',
        'forbidden_keywords_matched',
        'input_tokens',
        'output_tokens',
        'cost_usd',
        'llm_calls',
        'error',
    ].join(',');

    const csvRows = report.results.map((r) => {
        const m = r.serverMetrics ?? {};
        return [
            r.id,
            r.category,
            `"${r.question.replace(/"/g, '""')}"`,
            r.totalLatencyMs,
            r.serverProcessingTimeMs ?? '',
            r.ttfbProcessingMs ?? '',
            r.ttfbDataMs ?? '',
            r.responseLength,
            r.hasQuickReplies,
            r.hasPropertyCards,
            r.hasVisuals,
            r.keywordsMatched.length,
            r.keywordsMissed.length,
            r.forbiddenKeywordsMatched.length,
            toNum(m.inputTokens) || '',
            toNum(m.outputTokens) || '',
            toNum(m.totalCostUsd) || '',
            toNum(m.llmCalls) || '',
            r.error ? `"${r.error}"` : '',
        ].join(',');
    });

    fs.writeFileSync(csvPath, [csvHeader, ...csvRows].join('\n'), 'utf-8');

    console.log(`\n  Reports saved:`);
    console.log(`    JSON: ${jsonPath}`);
    console.log(`    CSV:  ${csvPath}`);
}

function printSummary(report: BenchmarkReport): void {
    const s = report.summary;
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  BENCHMARK REPORT: ${report.name.padEnd(41)}║
╠══════════════════════════════════════════════════════════════╣
║  Questions: ${String(s.totalQuestions).padStart(3)} | OK: ${String(s.successful).padStart(3)} | Failed: ${String(s.failed).padStart(3)}               ║
║                                                              ║
║  Latency (ms):                                               ║
║    avg: ${String(s.avgLatencyMs).padStart(6)} | p50: ${String(s.p50LatencyMs).padStart(6)} | p95: ${String(s.p95LatencyMs).padStart(6)} | p99: ${String(s.p99LatencyMs).padStart(6)} ║
║    min: ${String(s.minLatencyMs).padStart(6)} | max: ${String(s.maxLatencyMs).padStart(6)}                              ║
║                                                              ║
║  TTFB Processing avg: ${String(s.avgTtfbProcessingMs ?? 'N/A').padStart(6)} ms                            ║
║  Server processing:   ${String(s.avgServerProcessingMs ?? 'N/A').padStart(6)} ms                            ║
║  Avg response length: ${String(s.avgResponseLength).padStart(6)} chars                          ║
║  Keyword accuracy:    ${(s.keywordAccuracy * 100).toFixed(1).padStart(5)}%                             ║
╠══════════════════════════════════════════════════════════════╣
║  Tokens & Cost:                                              ║
║    Total input tokens:  ${String(s.totalInputTokens).padStart(8)}                          ║
║    Total output tokens: ${String(s.totalOutputTokens).padStart(8)}                          ║
║    Total tokens:        ${String(s.totalTokens).padStart(8)}                          ║
║    Total LLM calls:     ${String(s.totalLlmCalls).padStart(8)}                          ║
║    Total cost USD:      $${s.totalCostUsd.toFixed(4).padStart(7)}                          ║
║    Avg tokens/question: ${String(s.avgInputTokensPerQuestion).padStart(4)}in + ${String(s.avgOutputTokensPerQuestion).padStart(4)}out                  ║
║    Avg cost/question:   $${s.avgCostPerQuestion.toFixed(4).padStart(7)}                          ║
╠══════════════════════════════════════════════════════════════╣
║  By Category:                                                ║`);

    for (const [cat, data] of Object.entries(s.byCategory)) {
        console.log(
            `║    ${cat.padEnd(12)} | n=${String(data.count).padStart(2)} | avg=${String(data.avgMs).padStart(6)}ms | p95=${String(data.p95Ms).padStart(6)}ms    ║`,
        );
    }

    console.log(
        `╚══════════════════════════════════════════════════════════════╝`,
    );
}
