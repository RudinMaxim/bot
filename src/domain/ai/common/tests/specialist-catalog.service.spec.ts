import { SpecialistCatalogService } from '../../services/specialist-catalog.service';

describe('SpecialistCatalogService', () => {
    it('returns the strongest topic match', () => {
        const service = new SpecialistCatalogService();

        const specialist = service.findBestMatch(
            'у меня ошибка в документах по аккредитации',
            [
                {
                    id: 'accreditation-main',
                    fullName: 'Иванов Иван Иванович',
                    position: 'Специалист по аккредитации',
                    contact: '@ivanov',
                    topics: ['аккредитация', 'ошибка в документах'],
                    isDefault: true,
                },
            ],
        );

        expect(specialist?.id).toBe('accreditation-main');
    });

    it('falls back to the default specialist when overlap is weak', () => {
        const service = new SpecialistCatalogService();

        const specialist = service.findBestMatch('непонятный вопрос', [
            {
                id: 'accreditation-main',
                fullName: 'Иванов Иван Иванович',
                position: 'Специалист по аккредитации',
                contact: '@ivanov',
                topics: ['аккредитация'],
                isDefault: true,
            },
        ]);

        expect(specialist?.id).toBe('accreditation-main');
    });
});
