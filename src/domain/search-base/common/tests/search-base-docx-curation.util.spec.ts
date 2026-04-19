import {
    ALLOWED_MYS_SEARCH_BASE_SECTION_KEYS,
    curateMysSearchBaseDocxPayload,
} from '../utils/search-base-docx-curation.util';

describe('curateMysSearchBaseDocxPayload', () => {
    it('keeps only allowed Mys knowledge sections and drops faq', () => {
        const curated = curateMysSearchBaseDocxPayload({
            extractedAt: '2026-04-08T10:00:00.000Z',
            items: [
                {
                    id: 'object_overview-001',
                    sectionKey: 'object_overview',
                    question: 'Когда сдача?',
                    answer: 'III квартал 2028',
                },
                {
                    id: 'sales_and_purchase-001',
                    sectionKey: 'sales_and_purchase',
                    question: 'Есть ли trade-in?',
                    answer: 'Да, с фиксацией цены на 60 дней.',
                },
                {
                    id: 'faq-001',
                    sectionKey: 'faq',
                    question: 'Как оформить ЭЦП?',
                    answer: 'Через удостоверяющий центр.',
                },
            ],
        });

        expect(curated.items).toEqual([
            expect.objectContaining({ id: 'object_overview-001' }),
            expect.objectContaining({ id: 'sales_and_purchase-001' }),
        ]);
        expect(curated.curation).toEqual({
            strategy: 'allowed-sections-only',
            allowedSections: ALLOWED_MYS_SEARCH_BASE_SECTION_KEYS,
            includedItems: 2,
            excludedItems: 1,
        });
    });

    it('preserves payload shape when items are missing', () => {
        const curated = curateMysSearchBaseDocxPayload({});

        expect(curated.items).toEqual([]);
        expect(curated.curation?.includedItems).toBe(0);
        expect(curated.curation?.excludedItems).toBe(0);
    });
});
