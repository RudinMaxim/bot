import { Injectable, Logger } from '@nestjs/common';
import { extractErrorMessage } from '../common/utils';

type ActiveRun = {
    runId: string;
    controller: AbortController;
    startedAt: number;
    cancelledAt?: number;
};

type RecentCancellation = {
    runId: string;
    cancelledAt: number;
};

@Injectable()
export class AiCancellationService {
    private readonly logger = new Logger(AiCancellationService.name);
    private readonly activeRuns = new Map<string, ActiveRun>();
    private readonly recentCancellations = new Map<
        string,
        RecentCancellation
    >();
    private static readonly RECENT_CANCELLATION_TTL_MS = 30_000;

    startRun(sessionId: string, runId: string): { signal: AbortSignal } {
        this.recentCancellations.delete(sessionId);

        const prev = this.activeRuns.get(sessionId);
        if (prev) {
            try {
                prev.controller.abort('superseded');
            } catch (error) {
                this.logger.debug(
                    `[${sessionId}] Failed to abort previous run: ${extractErrorMessage(error)}`,
                );
            }
        }

        const controller = new AbortController();
        this.activeRuns.set(sessionId, {
            runId,
            controller,
            startedAt: Date.now(),
        });

        this.logger.debug(
            `[${sessionId}] Started run ${runId}${prev ? ' (aborted previous)' : ''}`,
        );

        return { signal: controller.signal };
    }

    cancel(sessionId: string, reason: string = 'cancelled'): boolean {
        const active = this.activeRuns.get(sessionId);
        if (!active) return false;

        const cancelledAt = Date.now();
        active.cancelledAt = cancelledAt;
        this.recentCancellations.set(sessionId, {
            runId: active.runId,
            cancelledAt,
        });

        try {
            active.controller.abort(reason);
        } catch (error) {
            this.logger.debug(
                `[${sessionId}] Failed to abort run ${active.runId}: ${extractErrorMessage(error)}`,
            );
        }

        this.logger.debug(
            `[${sessionId}] Cancel requested for run ${active.runId} (reason=${reason})`,
        );

        return true;
    }

    wasCancelled(sessionId: string, runId: string): boolean {
        this.clearExpiredRecentCancellation(sessionId);

        const active = this.activeRuns.get(sessionId);
        if (active?.runId === runId && active.cancelledAt) {
            return true;
        }

        return this.recentCancellations.get(sessionId)?.runId === runId;
    }

    completeRun(sessionId: string, runId: string): void {
        const active = this.activeRuns.get(sessionId);
        if (!active) return;
        if (active.runId !== runId) return;

        if (active.cancelledAt) {
            this.recentCancellations.set(sessionId, {
                runId,
                cancelledAt: active.cancelledAt,
            });
        }

        this.activeRuns.delete(sessionId);
        this.logger.debug(
            `[${sessionId}] Completed run ${runId} in ${Date.now() - active.startedAt}ms`,
        );
    }

    private clearExpiredRecentCancellation(sessionId: string): void {
        const recent = this.recentCancellations.get(sessionId);
        if (!recent) {
            return;
        }

        if (
            Date.now() - recent.cancelledAt >
            AiCancellationService.RECENT_CANCELLATION_TTL_MS
        ) {
            this.recentCancellations.delete(sessionId);
        }
    }
}
