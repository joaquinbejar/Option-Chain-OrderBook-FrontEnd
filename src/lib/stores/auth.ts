/**
 * Auth store — owns the JWT for the session. The token itself lives in the
 * data-layer holder (src/lib/api/auth-token.ts) so the REST/WS clients can
 * read it without importing a store; this store owns the lifecycle: decode,
 * persist (sessionStorage — per-tab, gone on close), expiry, and permissions.
 *
 * The token is never logged. Re-acquisition before expiry is manual: minting
 * needs the operator bootstrap secret, which the frontend must not retain.
 */

import { derived, writable } from 'svelte/store';
import { api, type Permission } from '$lib/api/client';
import { setAuthToken, onUnauthorized } from '$lib/api/auth-token';
import { getWebSocketClient } from '$lib/api/websocket';

export interface AuthState {
	authenticated: boolean;
	/** Subject claim — the token identity. */
	sub: string | null;
	permissions: Permission[];
	/** Expiry (ms since epoch). */
	expiresAt: number | null;
	/** True when the session ended without an explicit logout. */
	expired: boolean;
	/** True inside the pre-expiry warning window — re-mint before the drop. */
	expiringSoon: boolean;
	error: string | null;
}

const STORAGE_KEY = 'ocob.jwt';
/** Drop this long before the exp claim so in-flight calls don't 401. */
const EXPIRY_MARGIN_MS = 30_000;
/** Surface a warning this long before the drop. */
const EXPIRY_WARNING_MS = 5 * 60_000;

interface JwtPayload {
	sub: string;
	exp: number;
	permissions: Permission[];
}

/** Decode a JWT payload without verifying — the backend is the verifier. */
export function decodeJwtPayload(token: string): JwtPayload | null {
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	try {
		const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		const payload = JSON.parse(atob(base64));
		if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
		return {
			sub: payload.sub,
			exp: payload.exp,
			permissions: Array.isArray(payload.permissions) ? payload.permissions : []
		};
	} catch {
		return null;
	}
}

function createInitialState(): AuthState {
	return {
		authenticated: false,
		sub: null,
		permissions: [],
		expiresAt: null,
		expired: false,
		expiringSoon: false,
		error: null
	};
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>(createInitialState());

	let expiryTimer: ReturnType<typeof setTimeout> | null = null;
	let warningTimer: ReturnType<typeof setTimeout> | null = null;
	let unregister401: (() => void) | null = null;

	const clearTimers = () => {
		if (expiryTimer !== null) {
			clearTimeout(expiryTimer);
			expiryTimer = null;
		}
		if (warningTimer !== null) {
			clearTimeout(warningTimer);
			warningTimer = null;
		}
	};

	const dropSession = (reason: 'expired' | 'rejected' | 'logout') => {
		clearTimers();
		setAuthToken(null);
		if (typeof window !== 'undefined') {
			sessionStorage.removeItem(STORAGE_KEY);
			getWebSocketClient().disconnect();
		}
		// 'expired' is the local timer; 'rejected' is the backend refusing the
		// token — different diagnoses, different messages.
		set({
			...createInitialState(),
			expired: reason !== 'logout',
			error:
				reason === 'expired'
					? 'Session expired — authenticate again to continue.'
					: reason === 'rejected'
						? 'The backend rejected the session token — authenticate again.'
						: null
		});
	};

	/** Adopt a token: decode, validate expiry, persist, arm the expiry timer. */
	const adopt = (token: string): boolean => {
		const payload = decodeJwtPayload(token);
		if (!payload) {
			update((s) => ({ ...s, error: 'That is not a valid JWT.' }));
			return false;
		}
		const expiresAt = payload.exp * 1000;
		const remaining = expiresAt - Date.now();
		if (remaining <= EXPIRY_MARGIN_MS) {
			update((s) => ({ ...s, error: 'That token is expired (or expires immediately).' }));
			return false;
		}

		setAuthToken(token);
		if (typeof window !== 'undefined') {
			sessionStorage.setItem(STORAGE_KEY, token);
		}
		clearTimers();
		const dropInMs = remaining - EXPIRY_MARGIN_MS;
		expiryTimer = setTimeout(() => dropSession('expired'), dropInMs);
		if (dropInMs > EXPIRY_WARNING_MS) {
			warningTimer = setTimeout(
				() => update((s) => ({ ...s, expiringSoon: true })),
				dropInMs - EXPIRY_WARNING_MS
			);
		}

		set({
			authenticated: true,
			sub: payload.sub,
			permissions: payload.permissions,
			expiresAt,
			expired: false,
			// Short-lived tokens are already inside the warning window.
			expiringSoon: dropInMs <= EXPIRY_WARNING_MS,
			error: null
		});
		return true;
	};

	return {
		subscribe,

		/** Restore a persisted token (if still valid) and register 401 handling. */
		init() {
			if (typeof window === 'undefined') return;
			if (!unregister401) {
				unregister401 = onUnauthorized(() => dropSession('rejected'));
			}
			const stored = sessionStorage.getItem(STORAGE_KEY);
			if (stored && !adopt(stored)) {
				sessionStorage.removeItem(STORAGE_KEY);
			}
		},

		/** Use a token the operator already has (minted via the backend CLI). */
		useToken(token: string): boolean {
			return adopt(token.trim());
		},

		/** Mint a token through POST /auth/token with the bootstrap secret. */
		async login(secret: string, permissions: Permission[], ttlSecs?: number): Promise<boolean> {
			try {
				const resp = await api.issueToken(secret, permissions, ttlSecs);
				return adopt(resp.token);
			} catch (e) {
				console.error('Token issuance failed'); // never log the secret/response
				update((s) => ({
					...s,
					error:
						e instanceof Error && e.message !== 'Unknown error'
							? `Token issuance failed: ${e.message}`
							: 'Token issuance failed.'
				}));
				return false;
			}
		},

		logout() {
			dropSession('logout');
		},

		clearError: () => update((s) => ({ ...s, error: null })),

		disconnect() {
			clearTimers();
			if (unregister401) {
				unregister401();
				unregister401 = null;
			}
		},

		reset() {
			clearTimers();
			setAuthToken(null);
			set(createInitialState());
		}
	};
}

export const authStore = createAuthStore();

export const isAuthenticated = derived(authStore, ($a) => $a.authenticated);
/** Admin implies all permissions on the backend. */
export const isAdmin = derived(authStore, ($a) => $a.permissions.includes('admin'));
