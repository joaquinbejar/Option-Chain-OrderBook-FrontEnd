/**
 * Live order-book depth store for the /depth route.
 *
 * WS-driven (backend #129): selecting an option pair subscribes the shared
 * WebSocket to the `orderbook` and `trades` channels for both legs. The
 * backend answers each orderbook subscribe with an `orderbook_snapshot`, then
 * streams `orderbook_delta` frames carrying each changed level's RESULTING
 * quantity (0 = level removed). Deltas are best-effort: on a sequence gap the
 * store re-subscribes, which yields a fresh snapshot — the same mechanism the
 * client replays on reconnect. Wire cents → dollars exactly once, here.
 */

import { writable } from 'svelte/store';
import {
	getWebSocketClient,
	type WsMessage,
	type WsBookLevel,
	type WsOrderbookDeltaMessage
} from '$lib/api/websocket';

export interface DepthLevel {
	/** Level price in dollars. */
	price: number;
	/** Visible quantity at this level (contracts). */
	size: number;
	/** Cumulative quantity from the top of the book through this level. */
	total: number;
}

export interface OptionBookDepth {
	symbol: string;
	/** Sorted best-first. */
	bids: DepthLevel[];
	asks: DepthLevel[];
	/** Dollars; null when either side of the book is empty. */
	spread: number | null;
	/** Percent of the mid; null when either side is empty. */
	spreadPercent: number | null;
	/** Sum of the ladder's visible quantities per side. */
	bidDepthTotal: number;
	askDepthTotal: number;
	/** Ladder imbalance in [-1, 1]; 0 for an empty book. */
	imbalance: number;
	/** Client receive time of the last applied frame (ms since epoch). */
	updatedMs: number;
}

export interface TradeTapeEntry {
	tradeId: string;
	/** Which leg of the selected pair traded. */
	leg: 'CALL' | 'PUT';
	/** Execution price in dollars. */
	price: number;
	quantity: number;
	/** Backend execution timestamp (ms since epoch). */
	timestampMs: number;
}

export interface DepthState {
	call: OptionBookDepth | null;
	put: OptionBookDepth | null;
	/** True once a WS snapshot has been applied and deltas are streaming. */
	live: boolean;
	/** Newest first, capped at MAX_TAPE_TRADES. */
	trades: TradeTapeEntry[];
	loading: boolean;
	error: string | null;
}

/** How many levels the /depth ladder shows per side. */
export const DEPTH_LEVELS = 10;

/** Trades kept on the tape. */
export const MAX_TAPE_TRADES = 50;

/** Raw one-side book: price in CENTS → visible quantity. */
type RawSide = Map<number, number>;

interface RawBook {
	bids: RawSide;
	asks: RawSide;
}

function sideToLevels(side: RawSide, descending: boolean): DepthLevel[] {
	const sorted = [...side.entries()]
		.filter(([, quantity]) => quantity > 0)
		.sort(([a], [b]) => (descending ? b - a : a - b))
		.slice(0, DEPTH_LEVELS);
	let running = 0;
	return sorted.map(([priceCents, quantity]) => {
		running += quantity;
		return {
			price: priceCents / 100, // cents → dollars, the single conversion site
			size: quantity,
			total: running
		};
	});
}

/** Project a raw cents-keyed book into the display shape. Exported for tests. */
export function projectBook(symbol: string, raw: RawBook, updatedMs: number): OptionBookDepth {
	const bids = sideToLevels(raw.bids, true);
	const asks = sideToLevels(raw.asks, false);

	const bestBid = bids.length > 0 ? bids[0].price : null;
	const bestAsk = asks.length > 0 ? asks[0].price : null;

	let spread: number | null = null;
	let spreadPercent: number | null = null;
	if (bestBid !== null && bestAsk !== null) {
		spread = bestAsk - bestBid;
		const mid = (bestBid + bestAsk) / 2;
		spreadPercent = mid > 0 ? (spread / mid) * 100 : 0;
	}

	const bidDepthTotal = bids.length > 0 ? bids[bids.length - 1].total : 0;
	const askDepthTotal = asks.length > 0 ? asks[asks.length - 1].total : 0;
	const depthSum = bidDepthTotal + askDepthTotal;

	return {
		symbol,
		bids,
		asks,
		spread,
		spreadPercent,
		bidDepthTotal,
		askDepthTotal,
		imbalance: depthSum > 0 ? (bidDepthTotal - askDepthTotal) / depthSum : 0,
		updatedMs
	};
}

function rawFromSnapshot(bids: WsBookLevel[], asks: WsBookLevel[]): RawBook {
	return {
		bids: new Map(bids.map((l) => [l.price, l.quantity])),
		asks: new Map(asks.map((l) => [l.price, l.quantity]))
	};
}

function createInitialState(): DepthState {
	return { call: null, put: null, live: false, trades: [], loading: false, error: null };
}

function createDepthStore() {
	const { subscribe, set, update } = writable<DepthState>(createInitialState());

	let callSymbol: string | null = null;
	let putSymbol: string | null = null;
	// Per-symbol raw books and last applied sequence. A delta only applies on
	// top of a snapshot (sequence known) and only in order.
	const rawBooks = new Map<string, RawBook>();
	const lastSequence = new Map<string, number>();
	let wsUnsubscribe: (() => void) | null = null;

	const legOf = (symbol: string): 'call' | 'put' | null =>
		symbol === callSymbol ? 'call' : symbol === putSymbol ? 'put' : null;

	// Raw sides accumulate every delta'd price; only the top DEPTH_LEVELS are
	// displayed. Cap the accumulation so a long-lived subscription cannot grow
	// (and re-sort) an unbounded map — evict the worst-priced tail, which the
	// display window can never show anyway.
	const MAX_RAW_LEVELS = DEPTH_LEVELS * 4;

	const capSide = (side: RawSide, descending: boolean) => {
		if (side.size <= MAX_RAW_LEVELS) return;
		const sorted = [...side.keys()].sort((a, b) => (descending ? b - a : a - b));
		for (const price of sorted.slice(MAX_RAW_LEVELS)) {
			side.delete(price);
		}
	};

	const applyDelta = (raw: RawBook, changes: WsOrderbookDeltaMessage['data']['changes']) => {
		for (const change of changes) {
			const side = change.side === 'bid' ? raw.bids : raw.asks;
			if (change.quantity === 0) {
				side.delete(change.price);
			} else {
				side.set(change.price, change.quantity);
			}
		}
		capSide(raw.bids, true);
		capSide(raw.asks, false);
	};

	const handleWsMessage = (msg: WsMessage) => {
		if (msg.type === 'orderbook_snapshot') {
			const leg = legOf(msg.data.symbol);
			if (!leg) return;
			const raw = rawFromSnapshot(msg.data.bids, msg.data.asks);
			rawBooks.set(msg.data.symbol, raw);
			lastSequence.set(msg.data.symbol, msg.data.sequence);
			const book = projectBook(msg.data.symbol, raw, Date.now());
			update((s) => ({ ...s, [leg]: book, live: true, loading: false, error: null }));
		} else if (msg.type === 'orderbook_delta') {
			const leg = legOf(msg.data.symbol);
			if (!leg) return;
			const raw = rawBooks.get(msg.data.symbol);
			const last = lastSequence.get(msg.data.symbol);
			// No snapshot yet — the one in flight will supersede this delta.
			if (!raw || last === undefined) return;
			// Already applied (e.g. re-delivered around a resync) — drop.
			if (msg.data.sequence <= last) return;
			if (msg.data.sequence > last + 1) {
				// Dropped delta(s): the local book is no longer trustworthy.
				// Re-subscribe for a fresh snapshot and ignore this frame; drop
				// the sequence so nothing else applies until the snapshot lands,
				// and say so — a resyncing ladder must not read as live.
				lastSequence.delete(msg.data.symbol);
				update((s) => ({ ...s, live: false, loading: true }));
				if (typeof window !== 'undefined') {
					getWebSocketClient().resyncOrderbook(msg.data.symbol);
				}
				return;
			}
			applyDelta(raw, msg.data.changes);
			lastSequence.set(msg.data.symbol, msg.data.sequence);
			const book = projectBook(msg.data.symbol, raw, Date.now());
			update((s) => ({ ...s, [leg]: book }));
		} else if (msg.type === 'trade') {
			const leg = legOf(msg.data.symbol);
			if (!leg) return;
			const entry: TradeTapeEntry = {
				tradeId: msg.data.trade_id,
				leg: leg === 'call' ? 'CALL' : 'PUT',
				price: msg.data.price / 100,
				quantity: msg.data.quantity,
				timestampMs: msg.data.timestamp_ms
			};
			update((s) => {
				// A reconnect replays the trades subscription, so a trade can be
				// redelivered — the tape is keyed by trade_id and must not
				// double-print (or crash the keyed each).
				if (s.trades.some((t) => t.tradeId === entry.tradeId)) return s;
				return { ...s, trades: [entry, ...s.trades].slice(0, MAX_TAPE_TRADES) };
			});
		} else if (msg.type === 'error') {
			// Only claim the error while we are waiting for our snapshots — the
			// shared socket can carry errors from unrelated commands.
			update((s) => (s.loading && !s.live ? { ...s, loading: false, error: msg.data.message } : s));
		}
	};

	const unsubscribeSymbols = () => {
		if (typeof window === 'undefined') return;
		const ws = getWebSocketClient();
		for (const symbol of [callSymbol, putSymbol]) {
			if (symbol) {
				ws.unsubscribeOrderbook(symbol);
				ws.unsubscribeTrades(symbol);
			}
		}
	};

	return {
		subscribe,

		/**
		 * Point the live view at one strike's call/put pair: drop the previous
		 * subscriptions and subscribe both legs' orderbook + trades channels.
		 * The books paint when the backend's snapshots arrive.
		 */
		select(underlying: string, expiration: string, strike: number) {
			unsubscribeSymbols();
			rawBooks.clear();
			lastSequence.clear();
			// Instrument id format is the backend's canonical
			// UNDERLYING-EXPIRATION-STRIKE-STYLE, strike in cents.
			callSymbol = `${underlying}-${expiration}-${strike}-C`;
			putSymbol = `${underlying}-${expiration}-${strike}-P`;
			set({ ...createInitialState(), loading: true });

			if (typeof window === 'undefined') return;
			const ws = getWebSocketClient();
			ws.connect();
			if (!wsUnsubscribe) {
				wsUnsubscribe = ws.subscribe(handleWsMessage);
			}
			ws.subscribeOrderbook(callSymbol, DEPTH_LEVELS);
			ws.subscribeOrderbook(putSymbol, DEPTH_LEVELS);
			ws.subscribeTrades(callSymbol);
			ws.subscribeTrades(putSymbol);
		},

		/** Force fresh snapshots for both legs (the backend re-sends on subscribe). */
		resync() {
			if (typeof window === 'undefined') return;
			if (!callSymbol && !putSymbol) return;
			const ws = getWebSocketClient();
			// Not live again until the fresh snapshots land.
			update((s) => ({ ...s, live: false, loading: true }));
			for (const symbol of [callSymbol, putSymbol]) {
				if (symbol) {
					lastSequence.delete(symbol);
					ws.resyncOrderbook(symbol);
				}
			}
		},

		/** Drop subscriptions and state (the shared socket stays open). */
		reset() {
			unsubscribeSymbols();
			callSymbol = null;
			putSymbol = null;
			rawBooks.clear();
			lastSequence.clear();
			if (wsUnsubscribe) {
				wsUnsubscribe();
				wsUnsubscribe = null;
			}
			set(createInitialState());
		}
	};
}

export const depthStore = createDepthStore();
