import { omitUndefined } from './object.util';

describe('object.util', () => {
    it('removes undefined keys only', () => {
        expect(
            omitUndefined({
                keepString: 'value',
                keepNull: null,
                remove: undefined,
            }),
        ).toEqual({
            keepString: 'value',
            keepNull: null,
        });
    });
});
