import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { resourceRootPath } from 'src/shared/runtime-assets/common/utils/resource-paths.util';
import {
    SpecialistCatalogAsset,
    SpecialistInfo,
    SpecialistRecord,
} from '../common/types/specialist.types';

@Injectable()
export class SpecialistCatalogService {
    private readonly logger = new Logger(SpecialistCatalogService.name);
    private readonly catalog: SpecialistRecord[];

    constructor() {
        this.catalog = this.loadCatalog();
    }

    getAll(): SpecialistRecord[] {
        return [...this.catalog];
    }

    findBestMatch(
        query: string,
        specialists: ReadonlyArray<SpecialistRecord> = this.catalog,
    ): SpecialistRecord | undefined {
        const normalizedQuery = query.trim().toLowerCase();
        const ranked = specialists
            .map((specialist) => ({
                specialist,
                score: specialist.topics.filter((topic) =>
                    normalizedQuery.includes(topic.trim().toLowerCase()),
                ).length,
            }))
            .sort((left, right) => right.score - left.score);

        if ((ranked[0]?.score ?? 0) > 0) {
            return ranked[0]?.specialist;
        }

        return specialists.find((specialist) => specialist.isDefault);
    }

    toSpecialistInfo(
        specialist: SpecialistRecord,
        reason: string,
    ): SpecialistInfo {
        return {
            fullName: specialist.fullName,
            position: specialist.position,
            contact: specialist.contact,
            reason,
        };
    }

    private loadCatalog(): SpecialistRecord[] {
        const filePath = path.resolve(
            resourceRootPath(),
            'knowledge-base',
            'specialists',
            'ru.json',
        );

        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw) as SpecialistCatalogAsset;
            if (!Array.isArray(parsed.specialists)) {
                return [];
            }

            return parsed.specialists.filter((specialist) =>
                this.isValidSpecialistRecord(specialist),
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to load specialist catalog: ${message}`);
            return [];
        }
    }

    private isValidSpecialistRecord(
        value: unknown,
    ): value is SpecialistRecord {
        if (!value || typeof value !== 'object') {
            return false;
        }

        const candidate = value as Partial<SpecialistRecord>;
        return (
            typeof candidate.id === 'string' &&
            typeof candidate.fullName === 'string' &&
            typeof candidate.position === 'string' &&
            typeof candidate.contact === 'string' &&
            Array.isArray(candidate.topics) &&
            candidate.topics.every((topic) => typeof topic === 'string')
        );
    }
}
