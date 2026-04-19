import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'global_settings' })
@Unique('global_settings_key_key', ['key'])
export class GlobalSettingEntity {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: string;

    @Column({ name: 'key', type: 'text' })
    key!: string;

    @Column({ name: 'data', type: 'jsonb' })
    data!: Record<string, unknown>;

    @Column({ name: 'version', type: 'text' })
    version!: string;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt!: Date;
}
