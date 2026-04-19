import { MigrationInterface, QueryRunner } from 'typeorm';

export class PruneSiteAssistantActions20260212000000
    implements MigrationInterface
{
    name = 'PruneSiteAssistantActions20260212000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const supportedActions = [
            'navigate_to_page',
            'scroll_to_section',
            'highlight_element',
            'go_back',
        ];

        await queryRunner.query(
            `
            DELETE FROM site_assistant_action_settings
            WHERE action_name <> ALL($1::text[])
            `,
            [supportedActions],
        );
    }

    public down(queryRunner: QueryRunner): Promise<void> {
        void queryRunner;
        // Irreversible cleanup: removed actions are not restored in down migration.
        return Promise.resolve();
    }
}
