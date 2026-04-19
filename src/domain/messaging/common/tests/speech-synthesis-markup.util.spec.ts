import { formatMarkdownForSpeechSynthesis } from '../utils';

describe('speech-synthesis-markup.util', () => {
    it('converts markdown structure to natural TTS markup for russian', () => {
        const result = formatMarkdownForSpeechSynthesis(
            [
                '# Заголовок',
                '',
                'Короткий **важный факт** и [ссылка](https://example.com).',
                '',
                '- Первый пункт',
                '- Второй пункт',
            ].join('\n'),
            'ru',
        );

        expect(result).toBe(
            'Заголовок. <[medium]> Короткий **важный факт** и ссылка. <[small]> Первый пункт. <[small]> Второй пункт.',
        );
    });

    it('strips markdown emphasis for english and keeps pauses only', () => {
        const result = formatMarkdownForSpeechSynthesis(
            [
                '## Summary',
                '',
                'Use **clear settings** and _short replies_.',
                '',
                '1. First item',
                '2. Second item',
            ].join('\n'),
            'en',
        );

        expect(result).toBe(
            'Summary. <[medium]> Use clear settings and short replies. <[small]> First item. <[small]> Second item.',
        );
    });

    it('drops code fences and raw urls from spoken text', () => {
        const result = formatMarkdownForSpeechSynthesis(
            [
                'Посмотри пример:',
                '',
                '```ts',
                'const x = 1;',
                '```',
                '',
                'Документация: https://example.com/docs',
            ].join('\n'),
            'ru',
        );

        expect(result).toBe('Посмотри пример: <[medium]> Документация:');
    });

    it('converts markdown tables into short spoken rows', () => {
        const result = formatMarkdownForSpeechSynthesis(
            [
                '| Поле | Значение |',
                '| ---- | -------- |',
                '| Голос | marina |',
                '| Роль | friendly |',
            ].join('\n'),
            'ru',
        );

        expect(result).toBe(
            'Поле: Значение. <[small]> Голос: marina. <[small]> Роль: friendly.',
        );
    });

    it('reads ruble prices naturally instead of digit by digit', () => {
        const result = formatMarkdownForSpeechSynthesis(
            'Стоимость: **13 495 816 ₽**.',
            'ru',
        );

        expect(result).toBe(
            'Стоимость: тринадцать миллионов четыреста девяносто пять тысяч восемьсот шестнадцать рублей.',
        );
    });

    it('expands square meter abbreviations and ЖК', () => {
        const result = formatMarkdownForSpeechSynthesis(
            'ЖК «Мыс»: площадь 38 м², терраса 4 м кв., пентхаус 101 кв. м.',
            'ru',
        );

        expect(result).toBe(
            'жилой комплекс «Мыс»: площадь 38 квадратных метров, терраса 4 квадратных метра, пентхаус 101 квадратный метр.',
        );
    });

    it('converts compact ruble amounts into full spoken form', () => {
        const result = formatMarkdownForSpeechSynthesis(
            'Аренда: от 45 тыс. руб./мес. до 10,41 млн рублей.',
            'ru',
        );

        expect(result).toBe(
            'Аренда: от сорок пять тысяч рублей в месяц до десять миллионов четыреста десять тысяч рублей.',
        );
    });

    it('converts roman numerals in real estate contexts', () => {
        const result = formatMarkdownForSpeechSynthesis(
            'Срок сдачи — III квартал 2028 года, II очередь и IV корпус.',
            'ru',
        );

        expect(result).toBe(
            'Срок сдачи — третий квартал 2028 года, вторая очередь и четвертый корпус.',
        );
    });

    it('converts standalone roman numerals to cardinal numbers', () => {
        const result = formatMarkdownForSpeechSynthesis(
            'Планировки I, V и X уже опубликованы.',
            'ru',
        );

        expect(result).toBe('Планировки один, пять и десять уже опубликованы.');
    });

    it('keeps MR as letter pronunciation instead of mister', () => {
        const result = formatMarkdownForSpeechSynthesis(
            'MR Group и MR Club доступны для клиентов ЖК «Мыс».',
            'ru',
        );

        expect(result).toBe(
            'эм ар Group и эм ар Club доступны для клиентов жилой комплекс «Мыс».',
        );
    });
});
