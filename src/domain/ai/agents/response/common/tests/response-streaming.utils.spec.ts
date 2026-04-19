import { extractStreamedResponseText } from '../utils/response-streaming.utils';

describe('extractStreamedResponseText', () => {
    it('extracts completed response text from streamed JSON', () => {
        const raw =
            '{"response":"Первая строка\\nВторая строка с \\"цитатой\\"","confidence":"high"}';

        expect(extractStreamedResponseText(raw)).toEqual({
            text: 'Первая строка\nВторая строка с "цитатой"',
            complete: true,
        });
    });

    it('returns partial decoded text while JSON stream is incomplete', () => {
        const partial = '{"response":"Привет\\nм';

        expect(extractStreamedResponseText(partial)).toEqual({
            text: 'Привет\nм',
            complete: false,
        });
    });
});
