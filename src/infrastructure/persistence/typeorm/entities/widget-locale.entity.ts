import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'widget_locales' })
@Unique('widget_locales_locale_key', ['locale'])
export class WidgetLocaleEntity {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: string;

    @Column({ name: 'locale', type: 'text' })
    locale!: string;

    @Column({ name: 'data', type: 'jsonb' })
    data!: Record<string, unknown>;

    @Column({ name: 'version', type: 'text' })
    version!: string;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt!: Date;
}
