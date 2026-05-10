#!/usr/bin/env node

const http = require('node:http');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4000;
const DEFAULT_API_BASE = 'http://localhost:3500';

function normalizeApiBase(value) {
    return String(value || DEFAULT_API_BASE).replace(/\/+$/, '');
}

function parsePort(value) {
    const port = Number.parseInt(String(value || DEFAULT_PORT), 10);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
        return DEFAULT_PORT;
    }
    return port;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function resolveWidgetDevConfig(env = process.env) {
    return {
        host: env.WIDGET_DEV_HOST || DEFAULT_HOST,
        port: parsePort(env.WIDGET_DEV_PORT),
        apiBase: normalizeApiBase(env.WIDGET_API_BASE),
    };
}

function buildWidgetDevPage(config) {
    const apiBase = normalizeApiBase(config.apiBase);
    const scriptSrc = `${apiBase}/api/v1/messaging/widget.js`;

    return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Messaging Widget Dev</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, sans-serif;
      background: #f7f7f8;
      color: #202124;
    }

    html {
      width: 100%;
      height: 100%;
      font-size: 62.5%;
    }

    body {
      width: 100%;
      height: 100%;
      margin: 0;
    }
  </style>
</head>
<body data-widget-dev-page>
  <script src="${escapeHtml(scriptSrc)}" defer></script>
</body>
</html>`;
}

function createWidgetDevServer(config = resolveWidgetDevConfig()) {
    return http.createServer((request, response) => {
        const url = new URL(request.url || '/', 'http://localhost');

        if (request.method === 'GET' && url.pathname === '/health') {
            response.writeHead(200, {
                'content-type': 'text/plain; charset=utf-8',
            });
            response.end('ok');
            return;
        }

        if (
            request.method === 'GET' &&
            (url.pathname === '/' || url.pathname === '/index.html')
        ) {
            response.writeHead(200, {
                'content-type': 'text/html; charset=utf-8',
                'cache-control': 'no-store',
            });
            response.end(buildWidgetDevPage(config));
            return;
        }

        response.writeHead(404, {
            'content-type': 'text/plain; charset=utf-8',
        });
        response.end('not found');
    });
}

if (require.main === module) {
    const config = resolveWidgetDevConfig();
    const server = createWidgetDevServer(config);

    server.listen(config.port, config.host, () => {
        process.stdout.write(
            `Widget dev page: http://${config.host}:${config.port}\n`,
        );
        process.stdout.write(`Widget API base: ${config.apiBase}\n`);
    });
}

module.exports = {
    buildWidgetDevPage,
    createWidgetDevServer,
    resolveWidgetDevConfig,
};
