import { setLocaleDictionary } from 'src/shared/utils/texts';
import { normalizeQuickReplyInput } from '../utils/quick-reply-input.util';

describe('quick-reply-input.util', () => {
    beforeAll(() => {
        setLocaleDictionary('ru', {
            content: {
                ai: {
                    quickReplies: {
                        continue_search: 'Продолжить поиск',
                        show_all_apartments: 'Показать все квартиры',
                        parking_storage: 'Паркинг и кладовые',
                    },
                    quickReplyPrompts: {
                        continue_search:
                            'Продолжи подборку и покажи дополнительные варианты по текущему запросу.',
                        show_all_apartments:
                            'Покажи все доступные квартиры в ЖК «Мыс».',
                        parking_storage:
                            'Расскажи про паркинг и кладовые в ЖК «Мыс».',
                    },
                },
            },
        });
    });

    it('expands localized continue-search label to canonical prompt', () => {
        expect(normalizeQuickReplyInput('Продолжить поиск', 'ru')).toEqual({
            content:
                'Продолжи подборку и покажи дополнительные варианты по текущему запросу.',
            intent: 'continue_search',
        });
    });

    it('expands localized show-all-apartments label to canonical prompt', () => {
        expect(normalizeQuickReplyInput('Показать все квартиры', 'ru')).toEqual(
            {
                content: 'Покажи все доступные квартиры в ЖК «Мыс».',
                intent: 'check_availability',
            },
        );
    });

    it('expands localized parking label to canonical prompt', () => {
        expect(normalizeQuickReplyInput('Паркинг и кладовые', 'ru')).toEqual({
            content: 'Расскажи про паркинг и кладовые в ЖК «Мыс».',
            intent: 'ask_infrastructure',
        });
    });
});
