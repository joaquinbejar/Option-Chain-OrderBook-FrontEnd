const API_BASE = '/api/v1';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
	const response = await fetch(`${API_BASE}${endpoint}`, {
		headers: {
			'Content-Type': 'application/json',
			...options?.headers
		},
		...options
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ message: 'Unknown error' }));
		throw new Error(error.message || `HTTP ${response.status}`);
	}

	return response.json();
}

export const api = {
	// Health
	health: () => fetchApi<{ status: string; version: string }>('/health'),

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

	// Controls
	getControls: () =>
		fetchApi<{
			master_enabled: boolean;
			spread_multiplier: number;
			size_scalar: number;
			directional_skew: number;
		}>('/controls'),
	killSwitch: () =>
		fetchApi<{ success: boolean; message: string; master_enabled: boolean }>('/controls/kill-switch', {
			method: 'POST'
		}),
	enableQuoting: () =>
		fetchApi<{ success: boolean; message: string; master_enabled: boolean }>('/controls/enable', {
			method: 'POST'
		}),
	updateParameters: (params: { spreadMultiplier?: number; sizeScalar?: number; directionalSkew?: number }) =>
		fetchApi<{ success: boolean; spread_multiplier: number; size_scalar: number; directional_skew: number }>(
			'/controls/parameters',
			{
				method: 'POST',
				body: JSON.stringify(params)
			}
		),
	listInstruments: () =>
		fetchApi<{
			instruments: Array<{ symbol: string; quoting_enabled: boolean; current_price: number | null }>;
		}>('/controls/instruments'),
	toggleInstrument: (symbol: string) =>
		fetchApi<{ success: boolean; symbol: string; enabled: boolean }>(`/controls/instrument/${symbol}/toggle`, {
			method: 'POST'
		}),

	// Prices
	insertPrice: (data: { symbol: string; price: number; bid?: number; ask?: number; volume?: number; source?: string }) =>
		fetchApi<{ success: boolean; symbol: string; price_cents: number; timestamp: string }>('/prices', {
			method: 'POST',
			body: JSON.stringify(data)
		}),
	getLatestPrice: (symbol: string) =>
		fetchApi<{
			symbol: string;
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
				price: number;
				bid: number | null;
				ask: number | null;
				volume: number | null;
				timestamp: string;
			}>
		>('/prices')
};

export interface QuoteResponse {
	bid_price: number | null;
	bid_size: number;
	ask_price: number | null;
	ask_size: number;
	timestamp_ms: number;
}
