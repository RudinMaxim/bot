import { MetricsLogRepository } from '../../repository/metrics-log.repository';
import type { PostgresService } from 'src/infrastructure/postgres';
import type { ProcessingMetrics } from '../../common/types';

/**
 * Roadmap §5 contract: metrics_log INSERT must NOT include the raw
 * request_text / response_text columns. The repository hashes and
 * truncates the user text before it ever reaches the SQL parameter
 * list. If a future refactor regresses this, the test fails on both
 * the SQL shape AND the parameter contents.
 */
describe('MetricsLogRepository — §5 data minimization', () => {
    function makeRepo(): {
        repo: MetricsLogRepository;
        query: jest.Mock<Promise<unknown>, [string, unknown[]?]>;
    } {
        const query = jest
            .fn<Promise<unknown>, [string, unknown[]?]>()
            .mockResolvedValue({ rows: [] });
        const postgres = { query } as unknown as PostgresService;
        const repo = new MetricsLogRepository(postgres);
        return { repo, query };
    }

    const baseMetrics: ProcessingMetrics = {
        startTime: '2026-04-08T00:00:00.000Z',
        endTime: '2026-04-08T00:00:01.000Z',
        durationMs: 1000,
        path: 'fast',
    } as unknown as ProcessingMetrics;

    it('schema no longer references the raw text columns', async () => {
        const { repo, query } = makeRepo();
        await repo.save({
            sessionId: 'session-1',
            requestText: 'anything',
            responseText: 'anything',
            path: 'fast',
            metrics: baseMetrics,
            timestamp: '2026-04-08T00:00:01.000Z',
        });

        const [sqlText] = query.mock.calls[0];
        // Schema enforcement: SQL refers to fingerprint columns, never to
        // *_text. If someone re-adds the columns, this catches it.
        expect(sqlText).toContain('request_fingerprint');
        expect(sqlText).toContain('response_fingerprint');
        expect(sqlText).not.toContain('request_text');
        expect(sqlText).not.toContain('response_text');
    });

    it('caps the stored preview at 80 chars even for very long input', async () => {
        const { repo, query } = makeRepo();
        // 1KB of "sensitive" text — well past the preview boundary
        const sensitive =
            'user@example.com phone +7 999 1234567 ' + 'X'.repeat(1000);

        await repo.save({
            sessionId: 'session-1',
            requestText: sensitive,
            responseText: sensitive,
            path: 'fast',
            metrics: baseMetrics,
            timestamp: '2026-04-08T00:00:01.000Z',
        });

        const params = (query.mock.calls[0][1] ?? []) as unknown[];
        for (const p of params) {
            if (typeof p !== 'string') continue;
            // Bound: no parameter slot should ever contain the full text
            expect(p.length).toBeLessThan(sensitive.length);
            // The 1KB tail is definitely cut off
            expect(p).not.toContain('X'.repeat(200));
        }
    });

    it('includes a fingerprint, length and short preview for both fields', async () => {
        const { repo, query } = makeRepo();
        await repo.save({
            sessionId: 'session-1',
            requestText: 'a'.repeat(500),
            responseText: 'b'.repeat(500),
            path: 'fast',
            metrics: baseMetrics,
            timestamp: '2026-04-08T00:00:01.000Z',
        });

        const params = (query.mock.calls[0][1] ?? []) as unknown[];
        // Layout: [sessionId, req_fp, req_len, req_preview,
        //          res_fp, res_len, res_preview, path, metrics, timestamp]
        const [
            ,
            reqFp,
            reqLen,
            reqPreview,
            resFp,
            resLen,
            resPreview,
        ] = params;

        expect(reqFp).toMatch(/^[0-9a-f]{8}$/);
        expect(resFp).toMatch(/^[0-9a-f]{8}$/);
        expect(reqLen).toBe(500);
        expect(resLen).toBe(500);
        // Preview capped at 80 chars + ellipsis
        expect((reqPreview as string).length).toBeLessThanOrEqual(81);
        expect((resPreview as string).length).toBeLessThanOrEqual(81);
        expect((reqPreview as string).startsWith('a'.repeat(80))).toBe(true);
        expect((resPreview as string).startsWith('b'.repeat(80))).toBe(true);
    });

    it('handles empty strings without throwing', async () => {
        const { repo, query } = makeRepo();
        await expect(
            repo.save({
                sessionId: 'session-1',
                requestText: '',
                responseText: '',
                path: 'fast',
                metrics: baseMetrics,
                timestamp: '2026-04-08T00:00:01.000Z',
            }),
        ).resolves.toBeUndefined();
        const params = (query.mock.calls[0][1] ?? []) as unknown[];
        expect(params[1]).toBe(''); // req_fp
        expect(params[2]).toBe(0); // req_len
    });
});
