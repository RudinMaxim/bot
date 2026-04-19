import { MigrationInterface, QueryRunner } from 'typeorm';

export class SiteAssistantElementIndex20260210000000
    implements MigrationInterface
{
    name = 'SiteAssistantElementIndex20260210000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS site_assistant_element_pages (
                page_url TEXT PRIMARY KEY,
                page_title TEXT,
                locale TEXT,
                content_hash TEXT NOT NULL,
                last_crawled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                status TEXT NOT NULL DEFAULT 'ok',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS site_assistant_element_catalog (
                id BIGSERIAL PRIMARY KEY,
                page_url TEXT NOT NULL REFERENCES site_assistant_element_pages(page_url) ON DELETE CASCADE,
                element_id TEXT NOT NULL,
                role TEXT,
                section TEXT,
                label TEXT,
                text TEXT,
                href TEXT,
                content_hash TEXT NOT NULL,
                vector_id TEXT,
                embedding_status TEXT,
                embedding_error TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE (page_url, element_id)
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS site_assistant_element_page_idx
                ON site_assistant_element_catalog(page_url);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS site_assistant_element_id_idx
                ON site_assistant_element_catalog(element_id);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS site_assistant_element_embedding_status_idx
                ON site_assistant_element_catalog(embedding_status);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS site_assistant_element_updated_idx
                ON site_assistant_element_catalog(updated_at);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'DROP TABLE IF EXISTS site_assistant_element_catalog',
        );
        await queryRunner.query(
            'DROP TABLE IF EXISTS site_assistant_element_pages',
        );
    }
}
