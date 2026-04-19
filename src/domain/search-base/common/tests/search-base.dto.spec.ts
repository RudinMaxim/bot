import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SearchBaseQueryDto, SearchBaseUpsertDto } from '../dto';

describe('SearchBase DTO validation', () => {
    const buildValidUpsertPayload = (updatedAt?: unknown) => ({
        locale: 'ru',
        data: [
            {
                id: 'cms-123',
                title: 'Title',
                description: 'Description',
                content: 'Body',
                url: 'https://example.com/page',
                ...(updatedAt !== undefined ? { updatedAt } : {}),
            },
        ],
    });

    it('does not require source for upsert payload', () => {
        const dto = plainToInstance(
            SearchBaseUpsertDto,
            buildValidUpsertPayload(),
        );

        const errors = validateSync(dto, {
            whitelist: true,
            forbidNonWhitelisted: true,
        });

        expect(errors).toHaveLength(0);
    });

    it('rejects source in upsert payload', () => {
        const dto = plainToInstance(SearchBaseUpsertDto, {
            ...buildValidUpsertPayload(),
            source: 'cms',
        });

        const errors = validateSync(dto, {
            whitelist: true,
            forbidNonWhitelisted: true,
        });

        expect(JSON.stringify(errors)).toContain('source');
    });

    it('rejects missing required item fields in upsert payload', () => {
        const dto = plainToInstance(SearchBaseUpsertDto, {
            locale: 'ru',
            data: [
                {
                    title: 'Title',
                    description: 'Description',
                },
            ],
        });

        const errors = validateSync(dto, {
            whitelist: true,
            forbidNonWhitelisted: true,
        });
        const serialized = JSON.stringify(errors);

        expect(serialized).toContain('id');
        expect(serialized).toContain('content');
        expect(serialized).toContain('url');
    });

    it('rejects null id in upsert payload', () => {
        const dto = plainToInstance(SearchBaseUpsertDto, {
            ...buildValidUpsertPayload(),
            data: [
                {
                    ...buildValidUpsertPayload().data[0],
                    id: null,
                },
            ],
        });

        const errors = validateSync(dto, {
            whitelist: true,
            forbidNonWhitelisted: true,
        });

        expect(JSON.stringify(errors)).toContain('id');
    });

    it('accepts valid updatedAt in upsert payload', () => {
        const dto = plainToInstance(
            SearchBaseUpsertDto,
            buildValidUpsertPayload('2025-02-05T12:34:56Z'),
        );

        const errors = validateSync(dto, {
            whitelist: true,
            forbidNonWhitelisted: true,
        });

        expect(errors).toHaveLength(0);
    });

    it('rejects empty-string updatedAt in upsert payload', () => {
        const dto = plainToInstance(
            SearchBaseUpsertDto,
            buildValidUpsertPayload(''),
        );

        const errors = validateSync(dto, {
            whitelist: true,
            forbidNonWhitelisted: true,
        });

        expect(JSON.stringify(errors)).toContain('updatedAt');
    });

    it('rejects null updatedAt in upsert payload', () => {
        const dto = plainToInstance(
            SearchBaseUpsertDto,
            buildValidUpsertPayload(null),
        );

        const errors = validateSync(dto, {
            whitelist: true,
            forbidNonWhitelisted: true,
        });

        expect(JSON.stringify(errors)).toContain('updatedAt');
    });

    it('limits query length to 768 characters', () => {
        const dto = plainToInstance(SearchBaseQueryDto, {
            locale: 'ru',
            query: 'x'.repeat(769),
        });

        const errors = validateSync(dto, {
            whitelist: true,
            forbidNonWhitelisted: true,
        });

        expect(JSON.stringify(errors)).toContain('query');
    });

    it('rejects source and minSimilarity in query payload', () => {
        const dto = plainToInstance(SearchBaseQueryDto, {
            locale: 'ru',
            source: 'cms',
            minSimilarity: 0.7,
        });

        const errors = validateSync(dto, {
            whitelist: true,
            forbidNonWhitelisted: true,
        });
        const serialized = JSON.stringify(errors);

        expect(serialized).toContain('source');
        expect(serialized).toContain('minSimilarity');
    });
});
