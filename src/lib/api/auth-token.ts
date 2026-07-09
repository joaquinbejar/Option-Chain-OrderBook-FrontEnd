/**
 * Data-layer token holder. The REST client and the WebSocket client read the
 * current JWT from here; the auth store writes it. Keeping this inside
 * src/lib/api preserves the one-way layering — the data layer never imports
 * a store.
 */

// CLIENT-ONLY module state. Under adapter-node this module is process-wide;
// it must never be read from a server load function or the token would leak
// across requests. All writers/readers run behind browser guards today.
let currentToken: string | null = null;

/** Called by fetchApi when the backend answers 401 — the auth store listens. */
let unauthorizedListener: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
	currentToken = token;
}

export function getAuthToken(): string | null {
	return currentToken;
}

/** Register the single 401 listener; returns an unregister function. */
export function onUnauthorized(listener: () => void): () => void {
	unauthorizedListener = listener;
	return () => {
		if (unauthorizedListener === listener) {
			unauthorizedListener = null;
		}
	};
}

export function notifyUnauthorized(): void {
	unauthorizedListener?.();
}
