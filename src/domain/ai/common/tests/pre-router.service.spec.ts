import { CoordinatorPreRouterService } from '../../agents/coordinator/coordinator-pre-router.service';
import { AGENT_NAME } from '../../common/constants';

describe('CoordinatorPreRouterService', () => {
    function createService() {
        return new CoordinatorPreRouterService();
    }

    it('routes broad apartment selection to search and analytics', () => {
        const service = createService();

        const result = service.classify(
            'покажи все квартиры',
            'session_1',
        );

        expect(result.matched).toBe(true);
        expect(result.reason).toBe('property_search');
        expect(result.agents.map((agent) => agent.agent_name)).toEqual([
            AGENT_NAME.SEARCH,
            AGENT_NAME.ANALYZING,
        ]);
    });

    it('routes self-contained bedroom and building query to search and analytics', () => {
        const service = createService();

        const result = service.classify('однушка в Волге', 'session_1');

        expect(result.matched).toBe(true);
        expect(result.reason).toBe('property_search');
        expect(result.agents.map((agent) => agent.agent_name)).toEqual([
            AGENT_NAME.SEARCH,
            AGENT_NAME.ANALYZING,
        ]);
    });

    it('routes standalone building switch query to search and analytics', () => {
        const service = createService();

        const result = service.classify('Волгу', 'session_1');

        expect(result.matched).toBe(true);
        expect(result.reason).toBe('building_switch');
        expect(result.agents.map((agent) => agent.agent_name)).toEqual([
            AGENT_NAME.SEARCH,
            AGENT_NAME.ANALYZING,
        ]);
    });

    it('routes language switch query to site assistant', () => {
        const service = createService();

        const result = service.classify(
            'переключи язык на английский',
            'session_1',
        );

        expect(result.matched).toBe(true);
        expect(result.reason).toBe('site_navigation');
        expect(result.agents.map((agent) => agent.agent_name)).toEqual([
            AGENT_NAME.SITE_ASSISTANT,
        ]);
    });

    it('routes "кто ты" query to search knowledge flow', () => {
        const service = createService();

        const result = service.classify('Кто ты?', 'session_1');

        expect(result.matched).toBe(true);
        expect(result.reason).toBe('assistant_profile');
        expect(result.agents.map((agent) => agent.agent_name)).toEqual([
            AGENT_NAME.SEARCH,
        ]);
    });

    it('routes "как тебя зовут" query to search knowledge flow', () => {
        const service = createService();

        const result = service.classify('Как тебя зовут?', 'session_1');

        expect(result.matched).toBe(true);
        expect(result.reason).toBe('assistant_profile');
        expect(result.agents.map((agent) => agent.agent_name)).toEqual([
            AGENT_NAME.SEARCH,
        ]);
    });
});
