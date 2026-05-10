import {
    loadSearchBaseAsset,
    validateSearchBaseAsset,
} from '../utils/search-base-asset-loader.util';

describe('search-base-asset-loader.util', () => {
    const baseV4 = {
        dataset: 'accreditation',
        locale: 'ru',
        version: 4,
        steps: [] as Array<{
            id: string;
            displayName: string;
            targetId: string;
        }>,
    };

    it('accepts v4 items with category, queries and guardrails', () => {
        const payload = validateSearchBaseAsset({
            ...baseV4,
            items: [
                {
                    id: 'parking-underground',
                    category: 'parking',
                    title: 'Подземный паркинг',
                    queries: [
                        'есть ли паркинг',
                        'подземный паркинг',
                    ],
                    answer: 'В жилом комплексе предусмотрен подземный паркинг.',
                    guardrails: ['Не утверждать стоимость.'],
                    source: 'mys-curated',
                    order: 1,
                },
            ],
        });

        expect(payload).toMatchObject({
            version: 4,
            items: [
                expect.objectContaining({
                    category: 'parking',
                    title: 'Подземный паркинг',
                    queries: [
                        'есть ли паркинг',
                        'подземный паркинг',
                    ],
                    guardrails: ['Не утверждать стоимость.'],
                }),
            ],
        });
    });

    it('rejects legacy v2 items with topic/search_phrases/facts', () => {
        expect(() =>
            validateSearchBaseAsset({
                dataset: 'accreditation',
                locale: 'ru',
                version: 2,
                steps: [],
                items: [
                    {
                        id: 'legacy-001',
                        topic: 'parking',
                        intent: 'parking_availability',
                        title: 'Подземный паркинг',
                        search_phrases: ['есть ли паркинг'],
                        facts: ['факт'],
                        answer: 'ответ',
                        source: 'mys-curated-docx',
                        order: 1,
                    },
                ],
            }),
        ).toThrow('Invalid search-base asset item');
    });

    it('rejects payloads without items', () => {
        expect(() =>
            validateSearchBaseAsset({
                ...baseV4,
            }),
        ).toThrow('Invalid search-base asset');
    });

    it('rejects duplicate item ids', () => {
        expect(() =>
            validateSearchBaseAsset({
                ...baseV4,
                items: [
                    {
                        id: 'parking-underground',
                        category: 'parking',
                        title: 'Подземный паркинг',
                        queries: ['есть ли паркинг'],
                        answer: 'В жилом комплексе предусмотрен подземный паркинг.',
                        source: 'mys-curated',
                        order: 1,
                    },
                    {
                        id: 'parking-underground',
                        category: 'parking',
                        title: 'Покупка машиноместа',
                        queries: ['можно купить машиноместо'],
                        answer: 'Покупка машиноместа оформляется отдельно.',
                        source: 'mys-curated',
                        order: 2,
                    },
                ],
            }),
        ).toThrow('Duplicate item id');
    });

    it('rejects unknown keys at the top level', () => {
        expect(() =>
            validateSearchBaseAsset({
                ...baseV4,
                items: [],
                extra: true,
            }),
        ).toThrow('Unrecognized key');
    });

    it('rejects unknown keys inside an item', () => {
        expect(() =>
            validateSearchBaseAsset({
                ...baseV4,
                items: [
                    {
                        id: 'parking-underground',
                        category: 'parking',
                        title: 'Подземный паркинг',
                        queries: ['есть ли паркинг'],
                        answer: 'В жилом комплексе предусмотрен подземный паркинг.',
                        source: 'mys-curated',
                        order: 1,
                        extra: true,
                    },
                ],
            }),
        ).toThrow('Invalid search-base asset item');
    });

    it('rejects malformed queries list', () => {
        expect(() =>
            validateSearchBaseAsset({
                ...baseV4,
                items: [
                    {
                        id: 'parking-underground',
                        category: 'parking',
                        title: 'Подземный паркинг',
                        queries: [],
                        answer: 'В жилом комплексе предусмотрен подземный паркинг.',
                        source: 'mys-curated',
                        order: 1,
                    },
                ],
            }),
        ).toThrow('Invalid search-base asset item');
    });

    it('rejects asset items without title and answer', () => {
        expect(() =>
            validateSearchBaseAsset({
                ...baseV4,
                items: [
                    {
                        id: 'broken-001',
                        category: 'project_overview',
                        queries: ['как называется жк'],
                        source: 'mys-curated',
                        order: 1,
                    },
                ],
            }),
        ).toThrow('Invalid search-base asset item');
    });

    it('accepts valid followUpStepIds referencing the steps catalog', () => {
        const payload = validateSearchBaseAsset({
            dataset: 'accreditation',
            locale: 'ru',
            version: 4,
            steps: [
                {
                    id: 'uznat-o-kontaktakh',
                    displayName: 'Узнать контакты',
                    targetId: 'contacts-general',
                },
            ],
            items: [
                {
                    id: 'fac-overview',
                    category: 'about_center',
                    title: 'Что такое ФАЦ',
                    queries: ['что такое фац'],
                    answer: 'ФАЦ ПГМУ проводит аккредитацию.',
                    source: 'kb.md',
                    order: 1,
                    followUpStepIds: ['uznat-o-kontaktakh'],
                },
                {
                    id: 'contacts-general',
                    category: 'contacts',
                    title: 'Контакты',
                    queries: ['контакты'],
                    answer: 'Контакты центра.',
                    source: 'kb.md',
                    order: 2,
                },
            ],
        });

        expect(payload.items[0].followUpStepIds).toEqual([
            'uznat-o-kontaktakh',
        ]);
    });

    it('rejects followUpStepIds referencing unknown steps', () => {
        expect(() =>
            validateSearchBaseAsset({
                ...baseV4,
                items: [
                    {
                        id: 'fac-overview',
                        category: 'about_center',
                        title: 'Что такое ФАЦ',
                        queries: ['что такое фац'],
                        answer: 'ФАЦ ПГМУ проводит аккредитацию.',
                        source: 'kb.md',
                        order: 1,
                        followUpStepIds: ['does-not-exist'],
                    },
                ],
            }),
        ).toThrow('Unknown follow-up stepId');
    });

    it('loads FAC runtime corpus in v4 format', async () => {
        const payload = await loadSearchBaseAsset('mys/ru.json');
        const categories = new Set(payload.items.map((item) => item.category));

        expect(payload).toMatchObject({
            dataset: 'accreditation',
            locale: 'ru',
            version: 4,
        });
        expect(payload.items.length).toBeGreaterThanOrEqual(30);
        expect(payload.steps.length).toBeGreaterThan(0);
        expect(categories.has('about_center')).toBe(true);
        expect(categories.has('accreditation')).toBe(true);
        expect(categories.has('contacts')).toBe(true);
        expect(categories.has('schedule')).toBe(true);
        expect(payload.items[0]).toMatchObject({
            category: expect.any(String),
            title: expect.any(String),
            queries: expect.any(Array),
            answer: expect.any(String),
        });
        expect(payload.items.every((item) => item.queries.length >= 1)).toBe(
            true,
        );
    });
});
