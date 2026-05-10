import * as fs from 'fs';
import * as path from 'path';

import { validateSearchBaseAsset } from 'src/domain/search-base/common/utils/search-base-asset-loader.util';
import { resourceRootPath } from 'src/shared/runtime-assets/common/utils/resource-paths.util';

type SpecialistAsset = {
    specialists: Array<{
        id: string;
        fullName: string;
        position: string;
        contact: string;
        topics: string[];
        isDefault?: boolean;
    }>;
};

function readJsonAsset<T>(...segments: string[]): T {
    const filePath = path.resolve(resourceRootPath(), ...segments);
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
}

describe('knowledge-base assets', () => {
    it('contains a structured PSMU search base with key accreditation topics', () => {
        const asset = validateSearchBaseAsset(
            readJsonAsset('knowledge-base', 'search-base', 'mys', 'ru.json'),
        );

        expect(asset.dataset).toBe('accreditation');
        expect(asset.locale).toBe('ru');
        expect(asset.version).toBe(4);
        expect(asset.steps.length).toBeGreaterThan(0);
        expect(asset.items.length).toBeGreaterThanOrEqual(10);
        expect(asset.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'fac-overview',
                    category: 'about_center',
                }),
                expect.objectContaining({
                    id: 'accreditation-types',
                    category: 'accreditation',
                }),
                expect.objectContaining({
                    id: 'contacts-general',
                    category: 'contacts',
                }),
                expect.objectContaining({
                    id: 'working-hours',
                    category: 'schedule',
                }),
            ]),
        );
        expect(
            asset.items.some((item) =>
                item.followUpStepIds?.includes('uznat-kontakty'),
            ),
        ).toBe(true);
    });

    it('contains real FAC specialists instead of placeholders', () => {
        const asset = readJsonAsset<SpecialistAsset>(
            'knowledge-base',
            'specialists',
            'ru.json',
        );

        expect(asset.specialists.length).toBeGreaterThanOrEqual(8);
        expect(asset.specialists).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'artamonova-olga-antonovna',
                    fullName: 'Артамонова Ольга Антоновна',
                    position: 'Руководитель МАСЦ',
                }),
                expect.objectContaining({
                    id: 'musakulova-nursaule-vyacheslavovna',
                    fullName: 'Мусакулова Нурсауле Вячеславовна',
                }),
                expect.objectContaining({
                    id: 'bugorskaya-tatyana-evgenevna',
                    fullName: 'Бугорская Татьяна Евгеньевна',
                }),
            ]),
        );
        expect(asset.specialists).toEqual(
            expect.not.arrayContaining([
                expect.objectContaining({
                    fullName: 'Иванов Иван Иванович',
                }),
            ]),
        );

        const defaultSpecialists = asset.specialists.filter(
            (specialist) => specialist.isDefault,
        );

        expect(defaultSpecialists).toHaveLength(1);
    });
});
