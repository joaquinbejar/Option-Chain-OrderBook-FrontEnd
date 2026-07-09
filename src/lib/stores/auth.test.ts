import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/api/client', () => ({
	api: {
		issueToken: vi.fn()
	}
}));

vi.mock('$lib/api/websocket', async (importOriginal) => {
	const real = await importOriginal<typeof import('$lib/api/websocket')>();
	const { makeFakeWsClient } = await import('$lib/__tests__/mocks');
	const fake = makeFakeWsClient();
	return { ...real, getWebSocketClient: () => fake };
});

import { authStore, isAdmin, decodeJwtPayload } from './auth';
import { api } from '$lib/api/client';
import { getAuthToken, notifyUnauthorized } from '$lib/api/auth-token';
import { getWebSocketClient } from '$lib/api/websocket';
import type { FakeWsClient } from '$lib/__tests__/mocks';

const fakeWs = getWebSocketClient() as unknown as FakeWsClient;

function b64url(value: object): string {
	return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeJwt(payload: Record<string, unknown>): string {
	return `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(payload)}.signature`;
}

const NOW = 1_700_000_000_000;

function validToken(overrides: Record<string, unknown> = {}): string {
	return makeJwt({
		sub: 'desk-1',
		iss: 'ocob',
		iat: NOW / 1000,
		exp: NOW / 1000 + 3600,
		permissions: ['read', 'trade'],
		...overrides
	});
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
	authStore.disconnect();
	authStore.reset();
	sessionStorage.clear();
	vi.clearAllMocks();
});

afterEach(() => {
	authStore.disconnect();
	authStore.reset();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('decodeJwtPayload', () => {
	it('decodes a base64url payload', () => {
		const payload = decodeJwtPayload(validToken());
		expect(payload?.sub).toBe('desk-1');
		expect(payload?.permissions).toEqual(['read', 'trade']);
	});

	it('rejects garbage and structurally wrong tokens', () => {
		expect(decodeJwtPayload('not-a-jwt')).toBeNull();
		expect(decodeJwtPayload('a.b')).toBeNull();
		expect(decodeJwtPayload(`x.${btoa('{"no":"claims"}')}.y`)).toBeNull();
	});
});

describe('auth store', () => {
	it('useToken adopts a valid token: state, holder, sessionStorage', () => {
		const token = validToken();
		expect(authStore.useToken(token)).toBe(true);

		const s = get(authStore);
		expect(s.authenticated).toBe(true);
		expect(s.sub).toBe('desk-1');
		expect(s.permissions).toEqual(['read', 'trade']);
		expect(get(isAdmin)).toBe(false);
		expect(getAuthToken()).toBe(token);
		expect(sessionStorage.getItem('ocob.jwt')).toBe(token);
	});

	it('rejects an expired token without touching the holder', () => {
		expect(authStore.useToken(validToken({ exp: NOW / 1000 - 10 }))).toBe(false);
		expect(get(authStore).authenticated).toBe(false);
		expect(getAuthToken()).toBeNull();
		expect(get(authStore).error).toMatch(/expired/);
	});

	it('admin permission is reflected by the derived store', () => {
		authStore.useToken(validToken({ permissions: ['admin'] }));
		expect(get(isAdmin)).toBe(true);
	});

	it('login mints via the API and adopts the returned token', async () => {
		vi.mocked(api.issueToken).mockResolvedValue({
			token: validToken({ permissions: ['read'] }),
			expires_at: 'irrelevant'
		});

		await expect(authStore.login('s3cret', ['read'])).resolves.toBe(true);

		expect(api.issueToken).toHaveBeenCalledWith('s3cret', ['read'], undefined);
		expect(get(authStore).authenticated).toBe(true);
	});

	it('a failed login surfaces an error and stays unauthenticated', async () => {
		vi.mocked(api.issueToken).mockRejectedValue(new Error('Forbidden'));
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(authStore.login('wrong', ['read'])).resolves.toBe(false);

		const s = get(authStore);
		expect(s.authenticated).toBe(false);
		expect(s.error).toMatch(/Forbidden/);
	});

	it('logout clears state, storage, the holder, and closes the socket', () => {
		authStore.useToken(validToken());
		authStore.logout();

		expect(get(authStore).authenticated).toBe(false);
		expect(get(authStore).expired).toBe(false);
		expect(getAuthToken()).toBeNull();
		expect(sessionStorage.getItem('ocob.jwt')).toBeNull();
		expect(fakeWs.disconnect).toHaveBeenCalled();
	});

	it('init restores a still-valid persisted token and drops a stale one', () => {
		sessionStorage.setItem('ocob.jwt', validToken());
		authStore.init();
		expect(get(authStore).authenticated).toBe(true);

		authStore.reset();
		sessionStorage.setItem('ocob.jwt', validToken({ exp: NOW / 1000 - 10 }));
		authStore.init();
		expect(get(authStore).authenticated).toBe(false);
		expect(sessionStorage.getItem('ocob.jwt')).toBeNull();
	});

	it('expires the session shortly before the exp claim', () => {
		authStore.useToken(validToken()); // 1h ttl
		vi.advanceTimersByTime(3600_000 - 30_000);

		const s = get(authStore);
		expect(s.authenticated).toBe(false);
		expect(s.expired).toBe(true);
		expect(getAuthToken()).toBeNull();
	});

	it('a backend 401 drops the session once init registered the listener', () => {
		authStore.init();
		authStore.useToken(validToken());

		notifyUnauthorized();

		const s = get(authStore);
		expect(s.authenticated).toBe(false);
		expect(s.expired).toBe(true);
	});
});
