import { alignResponseWithUiActions, extractUiHints } from '../utils/response-ui-hints.utils';
import type { ResponseAgentInput } from '../types/response.types';

describe('response-ui-hints.utils', () => {
    it('extracts and deduplicates site action types from metadata extras', () => {
        const input: ResponseAgentInput = {
            sessionId: 's-1',
            originalQuery: 'тест',
            timestamp: new Date().toISOString(),
            metadata: {
                extras: {
                    contactFormRequired: true,
                    contactFormId: '  lead_form  ',
                    siteActions: [{ type: 'navigate_to_page' }, { type: 'scroll_to_section' }],
                    siteActionsTypes: ['scroll_to_section', 'highlight_element'],
                },
            } as ResponseAgentInput['metadata'],
        };

        const hints = extractUiHints(input);

        expect(hints.contactFormRequired).toBe(true);
        expect(hints.contactFormId).toBe('lead_form');
        expect(hints.siteActionsAvailable).toBe(true);
        expect(hints.siteActionTypes).toEqual([
            'scroll_to_section',
            'highlight_element',
            'navigate_to_page',
        ]);
    });

    it('removes contradiction sentence when UI actions are available', () => {
        const text =
            'Я не могу открыть раздел на сайте. Уже открыл нужный блок, уточните бюджет.';
        const aligned = alignResponseWithUiActions(text, 'ru', {
            contactFormRequired: false,
            siteActionsAvailable: true,
            siteActionTypes: ['navigate_to_page'],
        });

        expect(aligned).toContain('Я уже выполнил действие на сайте');
        expect(aligned.toLowerCase()).not.toContain('не могу открыть');
    });
});
