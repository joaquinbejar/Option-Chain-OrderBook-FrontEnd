/**
 * Wire-unit contract (source of truth: the Option-Chain-OrderBook backend).
 *
 * - Option/order prices travel as INTEGER CENTS everywhere: `QuoteResponse`
 *   bid/ask, the WS `quote` / `price` / `fill` frames, and `addOrder`'s
 *   `price`. Convert cents → dollars exactly once, at the store boundary —
 *   never in components.
 * - The `/prices` endpoints are the exception: underlying prices are DOLLARS
 *   (floats) on GET and on the POST request; only the POST response echoes
 *   `price_cents`.
 * - `size_scalar` is asymmetric on the backend: GET `/controls` (and the WS
 *   `config` frame) return a FRACTION in [0, 1], while POST
 *   `/controls/parameters` expects a PERCENT in [0, 100].
 *
 * Auth: every route except `/health` and `POST /auth/token` requires
 * `Authorization: Bearer <jwt>`. Permissions are JWT claims (`read`, `trade`,
 * `admin` — admin implies all); the market-maker controls need `admin`.
 */
import { getAuthToken, notifyUnauthorized } from '$lib/api/auth-token';
const API_BASE = '/api/v1';

/** Non-2xx responses throw this; `status` lets callers tell 401/403 apart. */
export class ApiError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
	}
}

async function fetchApi<T>(endpoint: string, options?: RequestInit, base = API_BASE): Promise<T> {
	const token = getAuthToken();
	const response = await fetch(`${base}${endpoint}`, {
		headers: {
			'Content-Type': 'application/json',
			// Every route except /health and /auth/token requires the JWT.
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...options?.headers
		},
		...options
	});

	if (!response.ok) {
		// A 401 means the session token is no longer accepted. A failed mint
		// (/auth/token with a wrong secret) is NOT a session event.
		if (response.status === 401 && endpoint !== '/auth/token') {
			notifyUnauthorized();
		}
		const error = await response.json().catch(() => ({ message: 'Unknown error' }));
		throw new ApiError(error.message || `HTTP ${response.status}`, response.status);
	}

	return response.json();
}

export type Permission = 'read' | 'trade' | 'admin';

export const api = {
	// Health — the backend registers /health unprefixed, NOT under /api/v1.
	health: () => fetchApi<{ status: string; version: string }>('/health', undefined, ''),

	// Auth — mint a JWT; gated by the operator's AUTH_BOOTSTRAP_SECRET.
	issueToken: (secret: string, permissions: Permission[], ttlSecs?: number) =>
		fetchApi<{ token: string; expires_at: string }>('/auth/token', {
			method: 'POST',
			body: JSON.stringify({ secret, permissions, ttl_secs: ttlSecs })
		}),

	// Stats
	getStats: () =>
		fetchApi<{
			underlying_count: number;
			total_expirations: number;
			total_strikes: number;
			total_orders: number;
		}>('/stats'),

	// Underlyings
	listUnderlyings: () => fetchApi<{ underlyings: string[] }>('/underlyings'),
	createUnderlying: (symbol: string) =>
		fetchApi<{ symbol: string }>(`/underlyings/${symbol}`, { method: 'POST' }),
	getUnderlying: (symbol: string) =>
		fetchApi<{
			symbol: string;
			expiration_count: number;
			total_strike_count: number;
			total_order_count: number;
		}>(`/underlyings/${symbol}`),
	deleteUnderlying: (symbol: string) =>
		fetchApi<{ success: boolean }>(`/underlyings/${symbol}`, { method: 'DELETE' }),

	// Expirations
	listExpirations: (underlying: string) =>
		fetchApi<{ expirations: string[] }>(`/underlyings/${underlying}/expirations`),
	createExpiration: (underlying: string, expiration: string) =>
		fetchApi<{ expiration: string }>(`/underlyings/${underlying}/expirations/${expiration}`, {
			method: 'POST'
		}),

	// Strikes
	listStrikes: (underlying: string, expiration: string) =>
		fetchApi<{ strikes: number[] }>(`/underlyings/${underlying}/expirations/${expiration}/strikes`),
	createStrike: (underlying: string, expiration: string, strike: number) =>
		fetchApi<{ strike: number }>(
			`/underlyings/${underlying}/expirations/${expiration}/strikes/${strike}`,
			{ method: 'POST' }
		),
	getStrike: (underlying: string, expiration: string, strike: number) =>
		fetchApi<{
			strike: number;
			call_order_count: number;
			put_order_count: number;
			call_quote: QuoteResponse;
			put_quote: QuoteResponse;
		}>(`/underlyings/${underlying}/expirations/${expiration}/strikes/${strike}`),

	// Options
	getOptionBook: (underlying: string, expiration: string, strike: number, style: 'call' | 'put') =>
		fetchApi<{
			symbol: string;
			total_bid_depth: number;
			total_ask_depth: number;
			bid_level_count: number;
			ask_level_count: number;
			order_count: number;
			quote: QuoteResponse;
		}>(`/underlyings/${underlying}/expirations/${expiration}/strikes/${strike}/options/${style}`),

	addOrder: (
		underlying: string,
		expiration: string,
		strike: number,
		style: 'call' | 'put',
		/** `price` is INTEGER CENTS (backend `AddOrderRequest.price: u128`). */
		order: { side: string; price: number; quantity: number }
	) =>
		fetchApi<{ order_id: string; message: string }>(
			`/underlyings/${underlying}/expirations/${expiration}/strikes/${strike}/options/${style}/orders`,
			{ method: 'POST', body: JSON.stringify(order) }
		),

	cancelOrder: (
		underlying: string,
		expiration: string,
		strike: number,
		style: 'call' | 'put',
		orderId: string
	) =>
		fetchApi<{ success: boolean; message: string }>(
			`/underlyings/${underlying}/expirations/${expiration}/strikes/${strike}/options/${style}/orders/${orderId}`,
			{ method: 'DELETE' }
		),

	getQuote: (underlying: string, expiration: string, strike: number, style: 'call' | 'put') =>
		fetchApi<QuoteResponse>(
			`/underlyings/${underlying}/expirations/${expiration}/strikes/${strike}/options/${style}/quote`
		),

	/**
	 * Cancel every open order matching the optional filters (none = all).
	 * Requires the `trade` permission.
	 */
	cancelAllOrders: (filters?: {
		underlying?: string;
		expiration?: string;
		side?: string;
		style?: 'call' | 'put';
	}) => {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(filters ?? {})) {
			if (value !== undefined) {
				params.set(key, value);
			}
		}
		const query = params.toString();
		return fetchApi<{ canceled_count: number; failed_count: number }>(
			`/orders/cancel-all${query ? `?${query}` : ''}`,
			{ method: 'DELETE' }
		);
	},

	/** Per-level order-book snapshot. `depth`: 'top' (default), a level count, or 'full'. */
	getOptionSnapshot: (
		underlying: string,
		expiration: string,
		strike: number,
		style: 'call' | 'put',
		depth: 'top' | 'full' | number = 'top'
	) =>
		fetchApi<EnrichedSnapshotResponse>(
			`/underlyings/${underlying}/expirations/${expiration}/strikes/${strike}/options/${style}/snapshot?depth=${depth}`
		),

	// Controls
	getControls: () =>
		fetchApi<{
			master_enabled: boolean;
			spread_multiplier: number;
			/** FRACTION in [0, 1] on read — the write side takes a percent. */
			size_scalar: number;
			directional_skew: number;
		}>('/controls'),
	killSwitch: () =>
		fetchApi<{ success: boolean; message: string; master_enabled: boolean }>(
			'/controls/kill-switch',
			{
				method: 'POST'
			}
		),
	enableQuoting: () =>
		fetchApi<{ success: boolean; message: string; master_enabled: boolean }>('/controls/enable', {
			method: 'POST'
		}),
	updateParameters: (params: {
		spreadMultiplier?: number;
		/** PERCENT in [0, 100] on write — the backend divides by 100. */
		sizeScalar?: number;
		directionalSkew?: number;
	}) =>
		fetchApi<{
			success: boolean;
			spread_multiplier: number;
			size_scalar: number;
			directional_skew: number;
		}>('/controls/parameters', {
			method: 'POST',
			body: JSON.stringify(params)
		}),
	listInstruments: () =>
		fetchApi<{
			instruments: Array<{
				symbol: string;
				quoting_enabled: boolean;
				current_price: number | null;
			}>;
		}>('/controls/instruments'),
	toggleInstrument: (symbol: string) =>
		fetchApi<{ success: boolean; symbol: string; enabled: boolean }>(
			`/controls/instrument/${symbol}/toggle`,
			{
				method: 'POST'
			}
		),

	// Prices — underlying prices are DOLLARS (floats) on this surface.
	insertPrice: (data: {
		symbol: string;
		/** DOLLARS — the backend converts to cents internally. */
		price: number;
		bid?: number;
		ask?: number;
		volume?: number;
		source?: string;
	}) =>
		fetchApi<{ success: boolean; symbol: string; price_cents: number; timestamp: string }>(
			'/prices',
			{
				method: 'POST',
				body: JSON.stringify(data)
			}
		),
	getLatestPrice: (symbol: string) =>
		fetchApi<{
			symbol: string;
			/** DOLLARS (float), as are `bid` / `ask`. */
			price: number;
			bid: number | null;
			ask: number | null;
			volume: number | null;
			timestamp: string;
		}>(`/prices/${symbol}`),
	getAllPrices: () =>
		fetchApi<
			Array<{
				symbol: string;
				/** DOLLARS (float), as are `bid` / `ask`. */
				price: number;
				bid: number | null;
				ask: number | null;
				volume: number | null;
				timestamp: string;
			}>
		>('/prices')
};

/**
 * Top-of-book quote as the backend serializes it.
 * `bid_price` / `ask_price` are INTEGER CENTS (`null` = that side is empty);
 * sizes are contract quantities. Convert to dollars once, in a store.
 */
export interface QuoteResponse {
	bid_price: number | null;
	bid_size: number;
	ask_price: number | null;
	ask_size: number;
	timestamp_ms: number;
}

/** One aggregated book level. `price` is INTEGER CENTS; `quantity` is contracts. */
export interface PriceLevelInfo {
	price: number;
	quantity: number;
	order_count: number;
}

/** Pre-calculated snapshot statistics. Prices are CENTS (floats); null = empty side. */
export interface SnapshotStats {
	mid_price: number | null;
	spread_bps: number | null;
	bid_depth_total: number;
	ask_depth_total: number;
	/** Order book imbalance in [-1, 1]. */
	imbalance: number;
	vwap_bid: number | null;
	vwap_ask: number | null;
}

/**
 * Per-level order-book snapshot. `bids` sorted by price descending, `asks`
 * ascending; level prices are INTEGER CENTS — convert once, in a store.
 */
export interface EnrichedSnapshotResponse {
	symbol: string;
	sequence: number;
	timestamp_ms: number;
	bids: PriceLevelInfo[];
	asks: PriceLevelInfo[];
	stats: SnapshotStats;
}
