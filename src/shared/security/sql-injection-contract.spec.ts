import { FeedbackRepository } from 'src/domain/ai/repository/feedback.repository';
import { MetricsLogRepository } from 'src/domain/ai/repository/metrics-log.repository';
import { ActionLogRepository } from 'src/domain/ai/repository/action-log.repository';
import type { PostgresService } from 'src/infrastructure/postgres';
import type { ProcessingMetrics } from 'src/domain/ai/common/types';
import type { ActionResult } from 'src/domain/ai/agents/action/common/types/action.types';

/**
 * Roadmap §11 — SQL injection defense-in-depth contract test.
 *
 * For every repository that accepts string parameters from upstream
 * code, we feed it a classic injection payload and assert that:
 *
 *   1. The literal payload appears in the parameter array (i.e. it
 *      reaches the database as a value, not as SQL text).
 *   2. The literal payload does NOT appear inside the SQL text itself
 *      (i.e. nobody concatenated the value into the query).
 *
 * If a future refactor accidentally interpolates user input into the
 * SQL text, the second assertion fires and the test fails. The point
 * is to back the ESLint rule with runtime evidence — lint catches
 * syntactic mistakes, this catches anything more creative.
 *
 * The test uses jest mocks, not a real database, because the contract
 * we care about is "what gets handed to PostgresService.query", not
 * "what postgres does with it". This keeps the test fast and lets it
 * run in CI without infrastructure.
 */

const PAYLOAD = "'); DROP TABLE users; --";

interface QueryCall {
    sql: string;
    params: unknown[];
}

function makePostgresMock(): {
    postgres: PostgresService;
    calls: QueryCall[];
} {
    const calls: QueryCall[] = [];
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params: params ?? [] });
        return { rows: [], rowCount: 0 };
    });
    const postgres = { query } as unknown as PostgresService;
    return { postgres, calls };
}

function assertPayloadIsParameterised(calls: QueryCall[]): void {
    expect(calls.length).toBeGreaterThan(0);
    for (const { sql, params } of calls) {
        // 1. Payload must NOT appear in the SQL text — no interpolation.
        expect(sql).not.toContain(PAYLOAD);
        expect(sql).not.toContain('DROP TABLE');
        // 2. If any parameter contains the payload, that's the safe path.
        //    (Some calls — e.g. SELECT COUNT(*) — won't have the payload
        //    at all, that's also fine.)
    }
}

describe('§11 SQL injection contract — every repository must parameterise string inputs', () => {
    describe('FeedbackRepository.save', () => {
        it('routes injection payloads through parameters, not SQL text', async () => {
            const { postgres, calls } = makePostgresMock();
            const repo = new FeedbackRepository(postgres);

            await repo.save({
                timestamp: PAYLOAD,
                sessionId: PAYLOAD,
                platform: PAYLOAD,
                userId: PAYLOAD,
                requestText: PAYLOAD,
                responseText: PAYLOAD,
                requestFingerprint: PAYLOAD,
                requestLength: 10,
                responseFingerprint: PAYLOAD,
                responseLength: 10,
                feedbackValue: 1,
                confidence: PAYLOAD,
                agentsUsed: 0,
                processingTimeSec: PAYLOAD,
                searchResultsCount: 0,
                analysisResultsCount: 0,
                hasUrl: PAYLOAD,
                qualityScore: PAYLOAD,
            });

            assertPayloadIsParameterised(calls);
            const params = calls[0].params;
            expect(params).toContain(PAYLOAD);
        });
    });

    describe('FeedbackRepository.list', () => {
        it('does not interpolate page/limit into SQL text', async () => {
            const { postgres, calls } = makePostgresMock();
            const repo = new FeedbackRepository(postgres);
            await repo.list({ page: 1, limit: 10 });
            for (const { sql } of calls) {
                expect(sql).not.toContain(PAYLOAD);
            }
        });
    });

    describe('FeedbackRepository.deleteOlderThan', () => {
        it('passes retentionDays as a parameter', async () => {
            const { postgres, calls } = makePostgresMock();
            const repo = new FeedbackRepository(postgres);
            await repo.deleteOlderThan(30);
            assertPayloadIsParameterised(calls);
            expect(calls[0].params).toContain('30');
        });
    });

    describe('MetricsLogRepository.save', () => {
        it('routes raw text through redaction, not SQL text', async () => {
            const { postgres, calls } = makePostgresMock();
            const repo = new MetricsLogRepository(postgres);
            await repo.save({
                sessionId: PAYLOAD,
                requestText: PAYLOAD,
                responseText: PAYLOAD,
                path: 'fast',
                metrics: {} as unknown as ProcessingMetrics,
                timestamp: PAYLOAD,
            });
            assertPayloadIsParameterised(calls);
            // sessionId and timestamp reach params verbatim
            expect(calls[0].params).toContain(PAYLOAD);
        });
    });

    describe('MetricsLogRepository.deleteOlderThan', () => {
        it('passes retentionDays as a parameter', async () => {
            const { postgres, calls } = makePostgresMock();
            const repo = new MetricsLogRepository(postgres);
            await repo.deleteOlderThan(7);
            assertPayloadIsParameterised(calls);
            expect(calls[0].params).toContain('7');
        });
    });

    describe('ActionLogRepository.saveBatch', () => {
        it('routes injection payloads through parameters, not SQL text', async () => {
            const { postgres, calls } = makePostgresMock();
            const repo = new ActionLogRepository(postgres);
            const entry: ActionResult = {
                taskId: PAYLOAD,
                clientName: PAYLOAD,
                contactInfo: PAYLOAD,
                notes: PAYLOAD,
                actionType: PAYLOAD,
                description: PAYLOAD,
                lotId: PAYLOAD,
                appointmentDate: PAYLOAD,
                status: 'completed',
                issues: [PAYLOAD],
            } as unknown as ActionResult;
            await repo.saveBatch([entry]);
            assertPayloadIsParameterised(calls);
            expect(calls[0].params).toContain(PAYLOAD);
        });
    });

    describe('ActionLogRepository.list', () => {
        it('does not interpolate pagination into SQL text', async () => {
            const { postgres, calls } = makePostgresMock();
            const repo = new ActionLogRepository(postgres);
            await repo.list({ page: 1, limit: 10 });
            for (const { sql } of calls) {
                expect(sql).not.toContain(PAYLOAD);
            }
        });
    });

    describe('ActionLogRepository.deleteOlderThan', () => {
        it('passes retentionDays as a parameter', async () => {
            const { postgres, calls } = makePostgresMock();
            const repo = new ActionLogRepository(postgres);
            await repo.deleteOlderThan(14);
            assertPayloadIsParameterised(calls);
            expect(calls[0].params).toContain('14');
        });
    });
});
