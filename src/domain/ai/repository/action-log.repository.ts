import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from 'src/infrastructure/postgres';

type ActionResult = {
    readonly taskId: string;
    readonly clientName?: string | null;
    readonly contactInfo?: string | null;
    readonly notes?: string | null;
    readonly actionType?: string | null;
    readonly description?: string | null;
    readonly lotId?: string | null;
    readonly appointmentDate?: string | null;
    readonly status: string;
    readonly issues?: ReadonlyArray<string> | null;
};

@Injectable()
export class ActionLogRepository {
    private readonly logger = new Logger(ActionLogRepository.name);

    constructor(private readonly postgres: PostgresService) {}

    async deleteOlderThan(retentionDays: number): Promise<number> {
        if (!Number.isFinite(retentionDays) || retentionDays <= 0) return 0;
        try {
            const result = await this.postgres.query<{ count: string }>(
                `
                WITH deleted AS (
                    DELETE FROM action_log
                    WHERE created_at < now() - ($1 || ' days')::interval
                    RETURNING 1
                )
                SELECT COUNT(*)::text AS count FROM deleted
                `,
                [String(retentionDays)],
            );
            return Number(result.rows[0]?.count ?? 0);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed to prune action_log: ${message}`);
            return 0;
        }
    }

    async saveBatch(results: ReadonlyArray<ActionResult>): Promise<void> {
        if (!results.length) return;

        try {
            const values: unknown[] = [];
            const placeholders = results.map((entry, index) => {
                const baseIndex = index * 10;
                values.push(
                    entry.taskId,
                    entry.clientName ?? null,
                    entry.contactInfo ?? null,
                    entry.notes ?? null,
                    entry.actionType ?? null,
                    entry.description ?? null,
                    entry.lotId ?? null,
                    entry.appointmentDate ?? null,
                    entry.status,
                    entry.issues ? [...entry.issues] : null,
                );
                const offset = baseIndex + 1;
                return `($${offset}, $${offset + 1}, $${offset + 2}, $${
                    offset + 3
                }, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${
                    offset + 7
                }, $${offset + 8}, $${offset + 9})`;
            });

            await this.postgres.query(
                `
                INSERT INTO action_log (
                    task_id,
                    client_name,
                    contact_info,
                    notes,
                    action_type,
                    description,
                    lot_id,
                    appointment_date,
                    status,
                    issues
                )
                VALUES ${placeholders.join(', ')}
                `,
                values,
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed to save action log: ${message}`);
        }
    }

    async list(params: {
        page: number;
        limit: number;
    }): Promise<{ items: ActionResult[]; total: number }> {
        const page = Math.max(params.page, 1);
        const limit = Math.max(params.limit, 1);
        const skip = (page - 1) * limit;

        const itemsPromise = this.postgres.query<ActionResult>(
            `
            SELECT
                task_id AS "taskId",
                client_name AS "clientName",
                contact_info AS "contactInfo",
                notes,
                action_type AS "actionType",
                description,
                lot_id AS "lotId",
                appointment_date AS "appointmentDate",
                status,
                issues
            FROM action_log
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            `,
            [limit, skip],
        );
        const totalPromise = this.postgres.query<{ total: string }>(
            'SELECT COUNT(*)::text AS total FROM action_log',
        );

        const [itemsResult, totalResult] = await Promise.all([
            itemsPromise,
            totalPromise,
        ]);
        const items = itemsResult.rows;
        const total = Number(totalResult.rows[0]?.total ?? 0);

        return { items, total };
    }
}
