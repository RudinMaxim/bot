import {
    buildSearchBaseText,
    isOrderChanged,
    isOutdatedUpdate,
    normalizeMoveAfter,
    normalizeOrderValue,
    normalizeSourceUpdatedAt,
    parseDate,
    resolveSearchBaseOrder,
    sortByOrder,
} from './search-base.util';

describe('search-base.util', () => {
    it('builds search-base text from non-empty fields only', () => {
        const text = buildSearchBaseText({
            title: 'Title',
            description: 'Description',
            content: '  ',
        });

        expect(text).toBe('Title\n\nDescription');
    });

    it('adds expanded aliases for ЖК, улица and район to search-base text', () => {
        const text = buildSearchBaseText({
            title: 'ЖК Мыс',
            description: 'Дом на ул. Ленина в р-не центра',
        });

        expect(text).toContain('ЖК Мыс');
        expect(text).toContain('жилой комплекс Мыс');
        expect(text).toContain('улица Ленина');
        expect(text).toContain('районе центра');
    });

    it('avoids duplicating title and answer when structured content is provided', () => {
        const text = buildSearchBaseText({
            title: 'Подземный паркинг',
            description: 'В проекте предусмотрен подземный паркинг.',
            content: [
                'category: parking',
                'title: Подземный паркинг',
                'queries: есть ли паркинг',
                'answer: В жилом комплексе предусмотрен подземный паркинг.',
            ].join('\n'),
        });

        expect(text).toBe(
            [
                'category: parking',
                'title: Подземный паркинг',
                'queries: есть ли паркинг',
                'answer: В жилом комплексе предусмотрен подземный паркинг.',
            ].join('\n'),
        );
    });

    it('uses explicit embedding text when provided', () => {
        const text = buildSearchBaseText({
            title: 'Полная карточка',
            description: 'Описание',
            content: 'category: misc\nanswer: полный ответ',
            embeddingText: 'title: Коротко\nqueries: короткий запрос\nanswer: ответ',
        });

        expect(text).toBe(
            'title: Коротко\nqueries: короткий запрос\nanswer: ответ',
        );
    });

    it('normalizes order values', () => {
        expect(normalizeOrderValue(2.9)).toBe(2);
        expect(normalizeOrderValue(0)).toBeNull();
        expect(normalizeOrderValue(undefined)).toBeNull();
    });

    it('resolves item order with explicit value priority', () => {
        const order = resolveSearchBaseOrder({
            item: {
                title: 'T',
                description: 'D',
                order: 7.8,
            },
            index: 0,
            storedOrder: 3,
            vectorOrder: 4,
        });

        expect(order).toBe(7);
    });

    it('sorts by order without mutating source array', () => {
        const source = [{ id: 'b', order: 2 }, { id: 'a', order: 1 }];

        const sorted = sortByOrder(source);

        expect(sorted.map((item) => item.id)).toEqual(['a', 'b']);
        expect(source.map((item) => item.id)).toEqual(['b', 'a']);
    });

    it('normalizes move-after value and detects order changes', () => {
        expect(normalizeMoveAfter(-1)).toBe(0);
        expect(normalizeMoveAfter(3.9)).toBe(3);
        expect(isOrderChanged(3, 4)).toBe(true);
        expect(isOrderChanged(undefined, undefined)).toBe(false);
    });

    it('works with source dates', () => {
        expect(parseDate('2024-01-01T00:00:00Z') instanceof Date).toBe(true);
        expect(parseDate('invalid-date')).toBeNull();
        expect(isOutdatedUpdate('2024-01-02T00:00:00Z', '2024-01-01T00:00:00Z')).toBe(
            true,
        );

        const normalized = normalizeSourceUpdatedAt('2024-01-01T00:00:00+03:00');
        expect(normalized).toBe('2023-12-31T21:00:00.000Z');
    });
});
