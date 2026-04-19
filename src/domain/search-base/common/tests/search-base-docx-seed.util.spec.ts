import {
    buildSearchBaseSeedFromAsset,
    buildSearchBaseSeedFromDocxExtract,
    loadSearchBaseAsset,
} from '../utils';

describe('buildSearchBaseSeedFromDocxExtract', () => {
    it('maps docx q/a payload into search-base seed payload', () => {
        const payload = buildSearchBaseSeedFromDocxExtract({
            extractedAt: '2026-04-08T10:00:00.000Z',
            items: [
                {
                    id: 'faq-001',
                    sectionKey: 'faq',
                    rowIndex: 1,
                    question: '  Какие есть парковки? ',
                    answer: ' Есть подземный паркинг и гостевые места. ',
                },
                {
                    id: 'faq-002',
                    sectionKey: 'faq',
                    rowIndex: 2,
                    question: '',
                    answer: 'Неполная запись',
                },
            ],
        });

        expect(payload).toEqual({
            locale: 'ru',
            source: 'mys-docx',
            data: [
                {
                    id: 'faq-001',
                    title: 'Какие есть парковки?',
                    description: 'Есть подземный паркинг и гостевые места.',
                    content: 'Есть подземный паркинг и гостевые места.',
                    source: 'mys-docx',
                    order: 1,
                    updatedAt: '2026-04-08T10:00:00.000Z',
                },
            ],
        });
    });

    it('builds fallback ids and truncates description when requested', () => {
        const payload = buildSearchBaseSeedFromDocxExtract(
            {
                items: [
                    {
                        sectionKey: 'club_houses',
                        rowIndex: 7,
                        question: 'Какой формат отделки?',
                        answer: 'Чистовая отделка от застройщика',
                    },
                ],
            },
            {
                locale: 'en',
                source: 'manual-import',
                maxDescriptionLength: 10,
            },
        );

        expect(payload).toEqual({
            locale: 'en',
            source: 'manual-import',
            data: [
                {
                    id: 'club_houses-007',
                    title: 'Какой формат отделки?',
                    description: 'Чистовая о',
                    content: 'Чистовая отделка от застройщика',
                    source: 'manual-import',
                    order: 1,
                    updatedAt: undefined,
                },
            ],
        });
    });
});

describe('buildSearchBaseSeedFromAsset', () => {
    it('maps knowledge-unit asset items into seed payload', () => {
        const payload = buildSearchBaseSeedFromAsset({
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
        } as never);

        expect(payload).toEqual({
            locale: 'ru',
            source: 'resource-asset',
            data: [
                {
                    id: 'parking-underground',
                    title: 'Подземный паркинг',
                    description: 'В проекте предусмотрен подземный паркинг.',
                    content: [
                        'topic: parking',
                        'intent: parking_availability',
                        'title: Подземный паркинг',
                        'search_phrases: есть ли паркинг | подземный паркинг',
                        'facts: В проекте предусмотрен подземный паркинг.',
                        'answer: В жилом комплексе предусмотрен подземный паркинг.',
                        'restrictions: Не утверждать стоимость.',
                        'tags: parking',
                    ].join('\n'),
                    source: 'mys-curated',
                    order: 1,
                },
            ],
        });
    });

    it('builds seed payload from the canonical mys corpus file', async () => {
        const asset = await loadSearchBaseAsset('mys/ru.json');
        const payload = buildSearchBaseSeedFromAsset(asset);

        expect(payload.locale).toBe('ru');
        expect(payload.source).toBe('resource-asset');
        expect(payload.data[0]).toMatchObject({
            title: expect.any(String),
            description: expect.any(String),
            content: expect.stringContaining('topic:'),
        });
    });
});
