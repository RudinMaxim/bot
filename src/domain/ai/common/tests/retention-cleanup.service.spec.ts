import { RetentionCleanupService } from '../../services/retention-cleanup.service';
import type { SecretsConfig } from 'src/infrastructure/config';

describe('RetentionCleanupService', () => {
    const makeRepo = (rows: number) => ({
        deleteOlderThan: jest.fn().mockResolvedValue(rows),
    });

    const makeSecrets = (
        metricsDays: number,
        feedbackDays: number,
        actionLogDays: number,
    ): SecretsConfig =>
        ({
            metrics: { logRetentionDays: metricsDays },
            retention: {
                feedbackDays,
                actionLogDays,
                audioTempCleanupHours: 1,
            },
        }) as unknown as SecretsConfig;

    it('forwards each repository its configured retention window', async () => {
        const metrics = makeRepo(5);
        const feedback = makeRepo(2);
        const actionLog = makeRepo(0);
        const service = new RetentionCleanupService(
            makeSecrets(30, 90, 60),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            metrics as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            feedback as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            actionLog as any,
        );

        const result = await service.pruneAll('manual');

        expect(metrics.deleteOlderThan).toHaveBeenCalledWith(30);
        expect(feedback.deleteOlderThan).toHaveBeenCalledWith(90);
        expect(actionLog.deleteOlderThan).toHaveBeenCalledWith(60);
        expect(result).toEqual({
            metricsLog: 5,
            feedback: 2,
            actionLog: 0,
        });
    });

    it('runs all three sweeps in parallel', async () => {
        const order: string[] = [];
        const repo = (name: string, rows: number) => ({
            deleteOlderThan: jest.fn().mockImplementation(async () => {
                order.push(`${name}:start`);
                await new Promise((r) => setTimeout(r, 5));
                order.push(`${name}:end`);
                return rows;
            }),
        });
        const metrics = repo('m', 1);
        const feedback = repo('f', 1);
        const actionLog = repo('a', 1);

        const service = new RetentionCleanupService(
            makeSecrets(1, 1, 1),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            metrics as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            feedback as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            actionLog as any,
        );
        await service.pruneAll('manual');

        // All three start before any of them finish → parallel.
        expect(order.slice(0, 3).sort()).toEqual([
            'a:start',
            'f:start',
            'm:start',
        ]);
    });

    it('runDailyCleanup invokes pruneAll with reason=cron', async () => {
        const metrics = makeRepo(0);
        const feedback = makeRepo(0);
        const actionLog = makeRepo(0);
        const service = new RetentionCleanupService(
            makeSecrets(30, 90, 60),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            metrics as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            feedback as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            actionLog as any,
        );
        const spy = jest.spyOn(service, 'pruneAll');
        await service.runDailyCleanup();
        expect(spy).toHaveBeenCalledWith('cron');
    });
});
