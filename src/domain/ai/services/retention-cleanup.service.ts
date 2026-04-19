import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SecretsConfig } from 'src/infrastructure/config';
import {
    ActionLogRepository,
    FeedbackRepository,
    MetricsLogRepository,
} from '../repository';

/**
 * Daily retention sweeper for the three log tables that store user
 * content (`metrics_log`, `feedback`, `action_log`). Each table has its
 * own retention window in `SecretsConfig.retention.*` /
 * `SecretsConfig.metrics.logRetentionDays`; rows older than that are
 * deleted by the corresponding repository, which already swallows DB
 * errors so a transient failure cannot poison the cron.
 *
 * Why a separate service: scheduling lives next to other domain
 * cron jobs (locales, search-base, site-assistant) instead of inside
 * the repositories themselves, so the retention policy stays in one
 * place and is easy to audit. Closes roadmap §6 (P1).
 */
@Injectable()
export class RetentionCleanupService {
    private readonly logger = new Logger(RetentionCleanupService.name);

    constructor(
        private readonly secrets: SecretsConfig,
        private readonly metricsLogRepository: MetricsLogRepository,
        private readonly feedbackRepository: FeedbackRepository,
        private readonly actionLogRepository: ActionLogRepository,
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async runDailyCleanup(): Promise<void> {
        await this.pruneAll('cron');
    }

    /**
     * Run all retention sweeps once. Exposed so it can be triggered
     * manually from tests / admin tooling without waiting for the cron
     * tick.
     */
    async pruneAll(reason: 'cron' | 'manual'): Promise<{
        metricsLog: number;
        feedback: number;
        actionLog: number;
    }> {
        const metricsRetention = this.secrets.metrics.logRetentionDays;
        const feedbackRetention = this.secrets.retention.feedbackDays;
        const actionLogRetention = this.secrets.retention.actionLogDays;

        const [metricsLog, feedback, actionLog] = await Promise.all([
            this.metricsLogRepository.deleteOlderThan(metricsRetention),
            this.feedbackRepository.deleteOlderThan(feedbackRetention),
            this.actionLogRepository.deleteOlderThan(actionLogRetention),
        ]);

        this.logger.log(
            `Retention sweep (${reason}): metrics_log=${metricsLog} ` +
                `(>${metricsRetention}d), feedback=${feedback} ` +
                `(>${feedbackRetention}d), action_log=${actionLog} ` +
                `(>${actionLogRetention}d)`,
        );

        return { metricsLog, feedback, actionLog };
    }
}
