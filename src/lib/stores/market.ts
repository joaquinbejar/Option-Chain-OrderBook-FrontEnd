/**
 * Market data store for real-time prices and quotes.
 */

import { writable, derived, get } from 'svelte/store';
import { getWebSocketClient, type WsMessage } from '$lib/api/websocket';
import { api } from '$lib/api/client';

// Types
export interface PriceData {
	symbol: string;
	price: number; // in dollars
	priceCents: number;
	previousPrice: number;
	change: number;
	changePercent: number;
	timestamp: string;
}

export interface QuoteData {
	symbol: string;
	expiration: string;
	strike: number;
	style: 'call' | 'put';
	bidPrice: number;
	askPrice: number;
	bidSize: number;
	askSize: number;
	spread: number;
	spreadPercent: number;
}

export interface MarketState {
	prices: Map<string, PriceData>;
	quotes: Map<string, QuoteData>;
	underlyings: string[];
	expirations: Map<string, string[]>;
	strikes: Map<string, number[]>;
	connected: boolean;
	lastUpdate: number;
}

// Initial state
const initialState: MarketState = {
	prices: new Map(),
	quotes: new Map(),
	underlyings: [],
	expirations: new Map(),
	strikes: new Map(),
	connected: false,
	lastUpdate: 0
};

// Create the store
function createMarketStore() {
	const { subscribe, set, update } = writable<MarketState>(initialState);

	let wsUnsubscribe: (() => void) | null = null;

	return {
		subscribe,

		/**
		 * Initialize the store and connect to WebSocket.
		 */
		async init() {
			// Load initial data from API
			try {
				const [underlyingsRes, pricesRes] = await Promise.all([
					api.listUnderlyings().catch(() => ({ underlyings: [] })),
					api.getAllPrices().catch(() => [])
				]);

				update((state) => {
					state.underlyings = underlyingsRes.underlyings;

					// Initialize prices
					for (const p of pricesRes) {
						state.prices.set(p.symbol, {
							symbol: p.symbol,
							price: p.price,
							priceCents: Math.round(p.price * 100),
							previousPrice: p.price,
							change: 0,
							changePercent: 0,
							timestamp: p.timestamp
						});
					}

					return state;
				});

				// Load expirations for each underlying
				for (const underlying of underlyingsRes.underlyings) {
					try {
						const expRes = await api.listExpirations(underlying);
						update((state) => {
							state.expirations.set(underlying, expRes.expirations);
							return state;
						});
					} catch (e) {
						console.warn(`Failed to load expirations for ${underlying}:`, e);
					}
				}
			} catch (e) {
				console.error('Failed to initialize market data:', e);
			}

			// Connect to WebSocket
			const ws = getWebSocketClient();
			ws.connect();

			wsUnsubscribe = ws.subscribe((message: WsMessage) => {
				this.handleWsMessage(message);
			});

			update((state) => ({ ...state, connected: ws.isConnected }));
		},

		/**
		 * Handle incoming WebSocket messages.
		 */
		handleWsMessage(message: WsMessage) {
			update((state) => {
				state.lastUpdate = Date.now();

				switch (message.type) {
					case 'price': {
						const { symbol, price_cents } = message.data;
						const price = price_cents / 100;
						const existing = state.prices.get(symbol);
						const previousPrice = existing?.price ?? price;

						state.prices.set(symbol, {
							symbol,
							price,
							priceCents: price_cents,
							previousPrice,
							change: price - previousPrice,
							changePercent: previousPrice > 0 ? ((price - previousPrice) / previousPrice) * 100 : 0,
							timestamp: new Date().toISOString()
						});
						break;
					}

					case 'quote': {
						const { symbol, expiration, strike, style, bid_price, ask_price, bid_size, ask_size } =
							message.data;
						const key = `${symbol}:${expiration}:${strike}:${style}`;
						const bidPrice = bid_price / 100;
						const askPrice = ask_price / 100;
						const spread = askPrice - bidPrice;
						const midPrice = (bidPrice + askPrice) / 2;

						state.quotes.set(key, {
							symbol,
							expiration,
							strike,
							style: style as 'call' | 'put',
							bidPrice,
							askPrice,
							bidSize: bid_size,
							askSize: ask_size,
							spread,
							spreadPercent: midPrice > 0 ? (spread / midPrice) * 100 : 0
						});
						break;
					}

					case 'connected': {
						state.connected = true;
						break;
					}
				}

				return state;
			});
		},

		/**
		 * Load strikes for an underlying and expiration.
		 */
		async loadStrikes(underlying: string, expiration: string) {
			try {
				const res = await api.listStrikes(underlying, expiration);
				update((state) => {
					const key = `${underlying}:${expiration}`;
					state.strikes.set(key, res.strikes);
					return state;
				});
				return res.strikes;
			} catch (e) {
				console.error(`Failed to load strikes for ${underlying}/${expiration}:`, e);
				return [];
			}
		},

		/**
		 * Get price for a symbol.
		 */
		getPrice(symbol: string): PriceData | undefined {
			return get({ subscribe }).prices.get(symbol);
		},

		/**
		 * Get quote for an option.
		 */
		getQuote(
			symbol: string,
			expiration: string,
			strike: number,
			style: 'call' | 'put'
		): QuoteData | undefined {
			const key = `${symbol}:${expiration}:${strike}:${style}`;
			return get({ subscribe }).quotes.get(key);
		},

		/**
		 * Disconnect and cleanup.
		 */
		disconnect() {
			if (wsUnsubscribe) {
				wsUnsubscribe();
				wsUnsubscribe = null;
			}
			const ws = getWebSocketClient();
			ws.disconnect();
			update((state) => ({ ...state, connected: false }));
		},

		/**
		 * Reset the store.
		 */
		reset() {
			set(initialState);
		}
	};
}

export const marketStore = createMarketStore();

// Derived stores for convenience
export const prices = derived(marketStore, ($market) => $market.prices);
export const underlyings = derived(marketStore, ($market) => $market.underlyings);
export const isConnected = derived(marketStore, ($market) => $market.connected);

/**
 * Get price as a derived store for a specific symbol.
 */
export function priceFor(symbol: string) {
	return derived(marketStore, ($market) => $market.prices.get(symbol));
}

/**
 * Get all prices as an array.
 */
export const priceList = derived(marketStore, ($market) => Array.from($market.prices.values()));
