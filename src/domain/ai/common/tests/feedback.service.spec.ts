import { FeedbackService } from '../../services/feedback.service';
import { FeedbackRepository } from '../../repository';
import { FeedbackInput, FeedbackRow } from '../../common/types';
import { AGENT_PRIORITY } from '../../common/constants';

/**
 * Roadmap §5 contract: feedback rows stored on disk MUST contain
 * truncated previews + fingerprints, never raw multi-KB user text.
 *
 * This is a behavioral lock — if a future refactor accidentally drops
 * the redaction step, this test catches it before production starts
 * collecting full PII again.
 */
describe('FeedbackService — §5 data minimization', () => {
    function buildInput(
        request: string,
        response: string,
    ): FeedbackInput {
        return {
            sessionId: 'session-1',
            requestText: request,
            responseText: response,
            feedbackValue: 1,
            metadata: {
                timestamp: '2026-04-08T00:00:00.000Z',
                platform: 'web',
                userId: 'user-1',
                confidence: AGENT_PRIORITY.HIGH,
                agentsUsed: 1,
                processingTimeMs: 1234,
                searchResultsCount: 1,
                analysisResultsCount: 0,
                hasUrl: false,
            },
        };
    }

    function makeService(): {
        service: FeedbackService;
        save: jest.Mock<Promise<void>, [FeedbackRow]>;
    } {
        const save = jest.fn<Promise<void>, [FeedbackRow]>().mockResolvedValue();
        const repo = { save } as unknown as FeedbackRepository;
        const service = new FeedbackService(repo);
        return { service, save };
    }

    it('truncates request/response to 240 chars and stores fingerprints', async () => {
        const longRequest = 'a'.repeat(1000);
        const longResponse = 'b'.repeat(1000);
        const { service, save } = makeService();

        await service.log(buildInput(longRequest, longResponse));

        expect(save).toHaveBeenCalledTimes(1);
        const row = save.mock.calls[0][0];

        // Preview is truncated to exactly 240 + ellipsis
        expect(row.requestText).toBe('a'.repeat(240) + '…');
        expect(row.responseText).toBe('b'.repeat(240) + '…');

        // Fingerprint is 8-hex sha256 prefix
        expect(row.requestFingerprint).toMatch(/^[0-9a-f]{8}$/);
        expect(row.responseFingerprint).toMatch(/^[0-9a-f]{8}$/);

        // Length reflects the ORIGINAL untruncated text
        expect(row.requestLength).toBe(1000);
        expect(row.responseLength).toBe(1000);

        // The stored row never contains the full original text
        expect(row.requestText.length).toBeLessThan(longRequest.length);
        expect(row.responseText.length).toBeLessThan(longResponse.length);
    });

    it('keeps short text intact and still computes fingerprint', async () => {
        const { service, save } = makeService();

        await service.log(buildInput('short prompt', 'short reply'));

        const row = save.mock.calls[0][0];
        expect(row.requestText).toBe('short prompt');
        expect(row.responseText).toBe('short reply');
        expect(row.requestLength).toBe(12);
        expect(row.responseLength).toBe(11);
        expect(row.requestFingerprint).toMatch(/^[0-9a-f]{8}$/);
    });

    it('produces stable fingerprints across calls (admin grouping works)', async () => {
        const { service, save } = makeService();

        await service.log(buildInput('repeat me', 'reply A'));
        await service.log(buildInput('repeat me', 'reply B'));

        const fp1 = save.mock.calls[0][0].requestFingerprint;
        const fp2 = save.mock.calls[1][0].requestFingerprint;
        expect(fp1).toBe(fp2);

        // But response fingerprints differ — sanity check
        expect(save.mock.calls[0][0].responseFingerprint).not.toBe(
            save.mock.calls[1][0].responseFingerprint,
        );
    });
});
