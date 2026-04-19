import { SetMetadata } from '@nestjs/common';
import { API_KEY_AUTH_KEY } from '../security.constants';

/**
 * Marks a controller/handler as protected by `ApiKeyGuard`.
 *
 * Two roles:
 *   1. Opt-in signal for `ApiKeyGuard` — present → guard enforces, absent
 *      → guard is inert (useful if the guard is ever registered globally
 *      instead of per-controller).
 *   2. Exemption for the global `IdentityGuard` — integration routes are
 *      authenticated by their API key, not by a widget session cookie,
 *      so identity resolution is intentionally skipped.
 *
 * Always pair with `@UseGuards(ApiKeyGuard)` on the controller.
 */
export const ApiKeyAuth = () => SetMetadata(API_KEY_AUTH_KEY, true);
