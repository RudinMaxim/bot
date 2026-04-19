import { ApiKeyRegistryService } from './api-key-registry.service';
import type { IntegrationApiKeyEntry } from '../config/security.config.interface';

function buildEntry(
    name: string,
    plain: string,
    role: 'admin' | 'read-only',
): IntegrationApiKeyEntry {
    return {
        name,
        hash: ApiKeyRegistryService.hashKey(plain),
        role,
    };
}

describe('ApiKeyRegistryService', () => {
    it('returns null for a missing or empty key', () => {
        const service = new ApiKeyRegistryService([
            buildEntry('admin_1', 'correct horse battery staple', 'admin'),
        ]);

        expect(service.verify(undefined)).toBeNull();
        expect(service.verify(null)).toBeNull();
        expect(service.verify('')).toBeNull();
        expect(service.verify('   ')).toBeNull();
        expect(service.verify(42)).toBeNull();
    });

    it('resolves a valid admin key', () => {
        const service = new ApiKeyRegistryService([
            buildEntry('admin_1', 'secret-admin', 'admin'),
            buildEntry('ro_1', 'secret-ro', 'read-only'),
        ]);

        expect(service.verify('secret-admin')).toEqual({
            name: 'admin_1',
            role: 'admin',
        });
    });

    it('resolves a valid read-only key', () => {
        const service = new ApiKeyRegistryService([
            buildEntry('ro_1', 'secret-ro', 'read-only'),
        ]);

        expect(service.verify('secret-ro')).toEqual({
            name: 'ro_1',
            role: 'read-only',
        });
    });

    it('returns null for an unknown key', () => {
        const service = new ApiKeyRegistryService([
            buildEntry('admin_1', 'secret-admin', 'admin'),
        ]);

        expect(service.verify('wrong-secret')).toBeNull();
    });

    it('trims whitespace before hashing', () => {
        const service = new ApiKeyRegistryService([
            buildEntry('admin_1', 'secret-admin', 'admin'),
        ]);

        expect(service.verify('  secret-admin  ')).toMatchObject({
            role: 'admin',
        });
    });

    it('rejects every key when the registry is empty', () => {
        const service = new ApiKeyRegistryService([]);
        expect(service.verify('anything')).toBeNull();
    });

    it('hashKey produces stable lowercase sha256 hex', () => {
        const hash = ApiKeyRegistryService.hashKey('secret');
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        expect(ApiKeyRegistryService.hashKey('secret')).toBe(hash);
        expect(ApiKeyRegistryService.hashKey('secret2')).not.toBe(hash);
    });
});
