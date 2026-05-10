const {
    buildWidgetDevPage,
    resolveWidgetDevConfig,
} = require('../../scripts/widget-dev-server.cjs') as {
    buildWidgetDevPage: (config: { apiBase: string }) => string;
    resolveWidgetDevConfig: (env?: NodeJS.ProcessEnv) => {
        host: string;
        port: number;
        apiBase: string;
    };
};

describe('widget dev server helpers', () => {
    it('builds a local page that embeds the messaging widget', () => {
        const html = buildWidgetDevPage({
            apiBase: 'http://localhost:3500',
        });

        expect(html).toContain('<title>Messaging Widget Dev</title>');
        expect(html).toContain(
            '<script src="http://localhost:3500/api/v1/messaging/widget.js" defer></script>',
        );
        expect(html).toContain('data-widget-dev-page');
        expect(html).not.toContain('<h1>');
        expect(html).not.toContain('<p>');
    });

    it('resolves defaults for the local test page', () => {
        expect(resolveWidgetDevConfig({} as NodeJS.ProcessEnv)).toEqual({
            host: '127.0.0.1',
            port: 4000,
            apiBase: 'http://localhost:3500',
        });
    });

    it('accepts env overrides and removes a trailing API slash', () => {
        expect(
            resolveWidgetDevConfig({
                WIDGET_DEV_HOST: '0.0.0.0',
                WIDGET_DEV_PORT: '4100',
                WIDGET_API_BASE: 'http://127.0.0.1:3501/',
            } as NodeJS.ProcessEnv),
        ).toEqual({
            host: '0.0.0.0',
            port: 4100,
            apiBase: 'http://127.0.0.1:3501',
        });
    });
});
