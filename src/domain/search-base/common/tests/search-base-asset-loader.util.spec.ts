import {
    loadSearchBaseAsset,
    validateSearchBaseAsset,
} from '../utils/search-base-asset-loader.util';

describe('search-base-asset-loader.util', () => {
    it('loads knowledge-unit assets with topic, intent, search_phrases and facts', () => {
        const payload = validateSearchBaseAsset({
            dataset: 'mys',
            locale: 'ru',
            version: 2,
            items: [
                {
                    id: 'parking-underground',
                    topic: 'parking',
                    intent: 'parking_availability',
                    title: 'Подземный паркинг',
                    search_phrases: [
                        'есть ли паркинг',
                        'подземный паркинг',
                    ],
                    facts: ['В проекте предусмотрен подземный паркинг.'],
                    answer: 'В жилом комплексе предусмотрен подземный паркинг.',
                    restrictions: ['Не утверждать стоимость.'],
                    tags: ['parking'],
                    source: 'mys-curated',
                    order: 1,
                },
            ],
        });

        expect(payload).toMatchObject({
            version: 2,
            items: [
                expect.objectContaining({
                    topic: 'parking',
                    intent: 'parking_availability',
                    title: 'Подземный паркинг',
                    search_phrases: [
                        'есть ли паркинг',
                        'подземный паркинг',
                    ],
                    facts: ['В проекте предусмотрен подземный паркинг.'],
                    restrictions: ['Не утверждать стоимость.'],
                }),
            ],
        });
    });

    it('rejects legacy question/section-only items after contract migration', () => {
        expect(() =>
            validateSearchBaseAsset({
                dataset: 'mys',
                locale: 'ru',
                version: 2,
                items: [
                    {
                        id: 'legacy-001',
                        section: {
                            key: 'object_overview',
                            title: 'Информация',
                        },
                        question: 'Есть ли паркинг?',
                        answer: 'Да',
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
                dataset: 'mys',
                locale: 'ru',
                version: 1,
            }),
        ).toThrow('Invalid search-base asset');
    });

    it('rejects duplicate item ids', () => {
        expect(() =>
            validateSearchBaseAsset({
                dataset: 'mys',
                locale: 'ru',
                version: 2,
                items: [
                    {
                        id: 'parking-underground',
                        topic: 'parking',
                        intent: 'parking_availability',
                        title: 'Подземный паркинг',
                        search_phrases: ['есть ли паркинг'],
                        facts: ['В проекте предусмотрен подземный паркинг.'],
                        answer: 'В жилом комплексе предусмотрен подземный паркинг.',
                        source: 'mys-curated',
                        order: 1,
                    },
                    {
                        id: 'parking-underground',
                        topic: 'parking',
                        intent: 'parking_purchase',
                        title: 'Покупка машиноместа',
                        search_phrases: ['можно купить машиноместо'],
                        facts: ['Покупка машиноместа требует отдельного подтверждения.'],
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
                dataset: 'mys',
                locale: 'ru',
                version: 1,
                items: [],
                extra: true,
            }),
        ).toThrow('Unrecognized key');
    });

    it('rejects unknown keys inside an item', () => {
        expect(() =>
            validateSearchBaseAsset({
                dataset: 'mys',
                locale: 'ru',
                version: 2,
                items: [
                    {
                        id: 'parking-underground',
                        topic: 'parking',
                        intent: 'parking_availability',
                        title: 'Подземный паркинг',
                        search_phrases: ['есть ли паркинг'],
                        facts: ['В проекте предусмотрен подземный паркинг.'],
                        answer: 'В жилом комплексе предусмотрен подземный паркинг.',
                        source: 'mys-curated',
                        order: 1,
                        extra: true,
                    },
                ],
            }),
        ).toThrow('Invalid search-base asset item');
    });

    it('rejects malformed knowledge-unit lists', () => {
        expect(() =>
            validateSearchBaseAsset({
                dataset: 'mys',
                locale: 'ru',
                version: 2,
                items: [
                    {
                        id: 'parking-underground',
                        topic: 'parking',
                        intent: 'parking_availability',
                        title: 'Подземный паркинг',
                        search_phrases: [],
                        facts: ['В проекте предусмотрен подземный паркинг.'],
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
                dataset: 'mys',
                locale: 'ru',
                version: 2,
                items: [
                    {
                        id: 'broken-001',
                        topic: 'project_overview',
                        intent: 'project_name',
                        search_phrases: ['как называется жк'],
                        facts: ['Название проекта: Мыс.'],
                        source: 'mys-curated',
                        order: 1,
                    },
                ],
            }),
        ).toThrow('Invalid search-base asset item');
    });

    it('loads mys runtime corpus in knowledge-unit format', async () => {
        const payload = await loadSearchBaseAsset('mys/ru.json');
        const topics = new Set(payload.items.map((item) => item.topic));

        expect(payload).toMatchObject({
            dataset: 'mys',
            locale: 'ru',
            version: 2,
        });
        expect(payload.items.length).toBeGreaterThanOrEqual(30);
        expect(topics.size).toBeGreaterThanOrEqual(6);
        expect(topics.has('project_overview')).toBe(true);
        expect(topics.has('quarter_amenities')).toBe(true);
        expect(topics.has('location_access')).toBe(true);
        expect(topics.has('purchase')).toBe(true);
        expect(topics.has('housing_formats')).toBe(true);
        expect(topics.has('developer')).toBe(true);
        expect(payload.items[0]).toMatchObject({
            topic: expect.any(String),
            intent: expect.any(String),
            title: expect.any(String),
            search_phrases: expect.any(Array),
            facts: expect.any(Array),
            answer: expect.any(String),
        });
        expect(
            payload.items.every(
                (item) =>
                    item.search_phrases.length >= 5 && item.facts.length >= 1,
            ),
        ).toBe(true);
    });
});
