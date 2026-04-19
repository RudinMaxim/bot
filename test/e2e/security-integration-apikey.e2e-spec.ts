import { NestFactory, Reflector } from '@nestjs/core';
import {
    INestApplication,
    Module,
    VersioningType,
    ValidationPipe,
} from '@nestjs/common';
import type { Server } from 'node:http';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import request = require('supertest');
import { ApiKeyRegistryService } from '../../src/shared/security/services/api-key-registry.service';
import { ApiKeyGuard } from '../../src/shared/security/guards/api-key.guard';
import { IntegrationMetricsController } from '../../src/infrastructure/integration/controller/integration-metrics.controller';
import { MetricsService } from '../../src/domain/ai/services';

/**
 * Integration API key e2e for Phase 1.B (§4.2).
 *
 * Boots `IntegrationMetricsController` behind `ApiKeyGuard` wired with a
 * real `ApiKeyRegistryService` holding two keys — one `admin`, one
 * `read-only`. We pick `IntegrationMetricsController` because it exposes
 * both GET (safe) and DELETE (mutating) endpoints, which is exactly what
 * the role check needs to distinguish.
 *
 * Scenarios:
 *  1. GET without X-API-Key                       → 401 API_KEY_REQUIRED
 *  2. GET with bogus key                          → 401 API_KEY_INVALID
 *  3. GET with read-only key                      → 200 (data passes through)
 *  4. DELETE with read-only key                   → 403 API_KEY_FORBIDDEN
 *  5. DELETE with admin key                       → 200
 *  6. GET with admin key                          → 200
 */

const ADMIN_KEY = 'admin-plain-key-0123456789';
const READONLY_KEY = 'readonly-plain-key-0123456789';

const metricsServiceMock = {
    getStats: jest.fn().mockResolvedValue({ stub: 'ok' }),
    getSessionStats: jest.fn(),
    resetGlobalStats: jest.fn().mockResolvedValue(undefined),
    clearSessionStats: jest.fn().mockResolvedValue(undefined),
};

@Module({
    controllers: [IntegrationMetricsController],
    providers: [
        Reflector,
        {
            provide: ApiKeyRegistryService,
            useFactory: () =>
                new ApiKeyRegistryService([
                    {
                        name: 'admin-key',
                        hash: ApiKeyRegistryService.hashKey(ADMIN_KEY),
                        role: 'admin',
                    },
                    {
                        name: 'readonly-key',
                        hash: ApiKeyRegistryService.hashKey(READONLY_KEY),
                        role: 'read-only',
                    },
                ]),
        },
        ApiKeyGuard,
        { provide: MetricsService, useValue: metricsServiceMock },
    ],
})
class IntegrationApiKeyTestModule {}

describe('Integration API key auth (e2e)', () => {
    let app: INestApplication;
    let httpServer: Server;

    beforeAll(async () => {
        app = await NestFactory.create(IntegrationApiKeyTestModule, {
            logger: false,
        });
        app.setGlobalPrefix('api');
        app.enableVersioning({ type: VersioningType.URI });
        app.useGlobalPipes(
            new ValidationPipe({ whitelist: true, transform: true }),
        );
        await app.init();
        httpServer = app.getHttpServer() as Server;
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        metricsServiceMock.getStats.mockClear();
        metricsServiceMock.resetGlobalStats.mockClear();
    });

    it('rejects GET without X-API-Key with 401 API_KEY_REQUIRED', async () => {
        const res = await request(httpServer)
            .get('/api/v1/integration/metrics/global')
            .expect(401);
        expect(res.body).toMatchObject({ code: 'API_KEY_REQUIRED' });
        expect(metricsServiceMock.getStats).not.toHaveBeenCalled();
    });

    it('rejects GET with bogus key with 401 API_KEY_INVALID', async () => {
        const res = await request(httpServer)
            .get('/api/v1/integration/metrics/global')
            .set('X-API-Key', 'definitely-not-a-real-key')
            .expect(401);
        expect(res.body).toMatchObject({ code: 'API_KEY_INVALID' });
        expect(metricsServiceMock.getStats).not.toHaveBeenCalled();
    });

    it('accepts GET with a read-only key', async () => {
        const res = await request(httpServer)
            .get('/api/v1/integration/metrics/global')
            .set('X-API-Key', READONLY_KEY)
            .expect(200);
        expect(res.body).toMatchObject({ success: true });
        expect(metricsServiceMock.getStats).toHaveBeenCalledTimes(1);
    });

    it('rejects DELETE with a read-only key with 403 API_KEY_FORBIDDEN', async () => {
        const res = await request(httpServer)
            .delete('/api/v1/integration/metrics/global/reset')
            .set('X-API-Key', READONLY_KEY)
            .expect(403);
        expect(res.body).toMatchObject({ code: 'API_KEY_FORBIDDEN' });
        expect(metricsServiceMock.resetGlobalStats).not.toHaveBeenCalled();
    });

    it('accepts DELETE with an admin key', async () => {
        await request(httpServer)
            .delete('/api/v1/integration/metrics/global/reset')
            .set('X-API-Key', ADMIN_KEY)
            .expect(200);
        expect(metricsServiceMock.resetGlobalStats).toHaveBeenCalledTimes(1);
    });

    it('accepts GET with an admin key', async () => {
        await request(httpServer)
            .get('/api/v1/integration/metrics/global')
            .set('X-API-Key', ADMIN_KEY)
            .expect(200);
        expect(metricsServiceMock.getStats).toHaveBeenCalledTimes(1);
    });
});
