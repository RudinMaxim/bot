import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'search_base_catalog' })
@Unique('search_base_catalog_locale_document_id_key', ['locale', 'documentId'])
@Index('search_base_locale_idx', ['locale'])
@Index('search_base_locale_order_idx', ['locale', 'order', 'updatedAt'])
@Index('search_base_embedding_status_idx', ['embeddingStatus'])
@Index('search_base_embedding_updated_idx', ['embeddingUpdatedAt'])
@Index('search_base_source_updated_idx', ['source', 'sourceUpdatedAt'])
export class SearchBaseCatalogEntity {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: string;

    @Column({ name: 'locale', type: 'text' })
    locale!: string;

    @Column({ name: 'document_id', type: 'text' })
    documentId!: string;

    @Column({ name: 'external_id', type: 'text', nullable: true })
    externalId!: string | null;

    @Column({ name: 'title', type: 'text' })
    title!: string;

    @Column({ name: 'description', type: 'text' })
    description!: string;

    @Column({ name: 'content', type: 'text', nullable: true })
    content!: string | null;

    @Column({ name: 'url', type: 'text', nullable: true })
    url!: string | null;

    @Column({ name: 'source', type: 'text', nullable: true })
    source!: string | null;

    @Column({ name: 'content_hash', type: 'text' })
    contentHash!: string;

    @Column({ name: 'source_updated_at', type: 'text' })
    sourceUpdatedAt!: string;

    @Column({ name: 'content_length', type: 'integer' })
    contentLength!: number;

    @Column({ name: 'section_count', type: 'integer', nullable: true })
    sectionCount!: number | null;

    @Column({ name: 'sort_order', type: 'integer', nullable: true })
    order!: number | null;

    @Column({ name: 'vector_id', type: 'text', nullable: true })
    vectorId!: string | null;

    @Column({ name: 'embedding_status', type: 'text', nullable: true })
    embeddingStatus!: string | null;

    @Column({ name: 'embedding_error', type: 'text', nullable: true })
    embeddingError!: string | null;

    @Column({ name: 'embedding_updated_at', type: 'text', nullable: true })
    embeddingUpdatedAt!: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt!: Date;
}
