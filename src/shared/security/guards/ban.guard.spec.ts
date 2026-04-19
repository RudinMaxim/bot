import { BanGuard } from './ban.guard';
import { BanListService } from '../services/ban-list.service';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

const makeCtx = (req: unknown): ExecutionContext =>
    ({
        switchToHttp: () => ({ getRequest: () => req }),
        getHandler: () => undefined,
        getClass: () => undefined,
    }) as unknown as ExecutionContext;

describe('BanGuard', () => {
    let banList: jest.Mocked<Pick<BanListService, 'isBanned'>>;
    let guard: BanGuard;

    beforeEach(() => {
        banList = { isBanned: jest.fn().mockResolvedValue(false) };
        guard = new BanGuard(banList as unknown as BanListService);
    });

    it('allows request when no ban matches', async () => {
        const ctx = makeCtx({
            ip: '1.2.3.4',
            headers: {},
            identity: undefined,
        });
        await expect(guard.canActivate(ctx)).resolves.toBe(true);
        expect(banList.isBanned).toHaveBeenCalledWith({
            ip: '1.2.3.4',
            sessionId: undefined,
        });
    });

    it('reads sessionId from req.identity if present', async () => {
        const ctx = makeCtx({
            ip: '1.2.3.4',
            headers: {},
            identity: { sessionId: 'sess-1', source: 'cookie', issuedAt: 0 },
        });
        await guard.canActivate(ctx);
        expect(banList.isBanned).toHaveBeenCalledWith({
            ip: '1.2.3.4',
            sessionId: 'sess-1',
        });
    });

    it('falls back to socket.remoteAddress if req.ip missing', async () => {
        const ctx = makeCtx({
            socket: { remoteAddress: '5.6.7.8' },
            headers: {},
        });
        await guard.canActivate(ctx);
        expect(banList.isBanned).toHaveBeenCalledWith({
            ip: '5.6.7.8',
            sessionId: undefined,
        });
    });

    it('throws ForbiddenException when banned', async () => {
        banList.isBanned.mockResolvedValueOnce(true);
        const ctx = makeCtx({ ip: '1.2.3.4', headers: {} });
        await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
            ForbiddenException,
        );
    });

    it('ForbiddenException carries code BANNED', async () => {
        banList.isBanned.mockResolvedValueOnce(true);
        const ctx = makeCtx({ ip: '1.2.3.4', headers: {} });
        try {
            await guard.canActivate(ctx);
            fail('should have thrown');
        } catch (e) {
            expect((e as ForbiddenException).getResponse()).toMatchObject({
                code: 'BANNED',
            });
        }
    });
});
