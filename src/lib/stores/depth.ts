/**
 * Order-book depth store for the /depth route. Loads per-level snapshots for
 * a call/put pair and converts wire cents → dollars exactly once, here.
 */

import { writable } from 'svelte/store';
import { api, type EnrichedSnapshotResponse } from '$lib/api/client';

export interface DepthLevel {
	/** Level price in dollars. */
	price: number;
	/** Visible quantity at this level (contracts). */
	size: number;
	/** Cumulative quantity from the top of the book through this level. */
	total: number;
	orderCount: number;
}

export interface OptionBookDepth {
	symbol: string;
	/** Sorted best-first, as the backend sends them. */
	bids: DepthLevel[];
	asks: DepthLevel[];
	/** Dollars; null when either side of the book is empty. */
	spread: number | null;
	/** Percent of the mid; null when either side is empty. */
	spreadPercent: number | null;
	bidDepthTotal: number;
	askDepthTotal: number;
	/** Order book imbalance in [-1, 1]. */
	imbalance: number;
	/** Snapshot time (ms since epoch) — this is point-in-time data, not a stream. */
	timestampMs: number;
}

export interface DepthState {
	call: OptionBookDepth | null;
	put: OptionBookDepth | null;
	loading: boolean;
	error: string | null;
}

/** How many levels the /depth ladder requests per side. */
export const DEPTH_LEVELS = 10;

function accumulate(levels: EnrichedSnapshotResponse['bids']): DepthLevel[] {
	let running = 0;
	return levels.map((level) => {
		running += level.quantity;
		return {
			price: level.price / 100, // cents → dollars, the single conversion site
			size: level.quantity,
			total: running,
			orderCount: level.order_count
		};
	});
}

/** Map a wire snapshot to display shape. Exported for tests. */
export function toBookDepth(snap: EnrichedSnapshotResponse): OptionBookDepth {
	const bids = accumulate(snap.bids);
	const asks = accumulate(snap.asks);

	const bestBid = bids.length > 0 ? bids[0].price : null;
	const bestAsk = asks.length > 0 ? asks[0].price : null;

	let spread: number | null = null;
	let spreadPercent: number | null = null;
	if (bestBid !== null && bestAsk !== null) {
		spread = bestAsk - bestBid;
		// Prefer the backend's own spread_bps so the percent matches what it
		// reports elsewhere; only the dollar delta is derived locally.
		if (snap.stats.spread_bps !== null) {
			spreadPercent = snap.stats.spread_bps / 100;
		} else {
			const mid = (bestBid + bestAsk) / 2;
			spreadPercent = mid > 0 ? (spread / mid) * 100 : 0;
		}
	}

	return {
		symbol: snap.symbol,
		bids,
		asks,
		spread,
		spreadPercent,
		bidDepthTotal: snap.stats.bid_depth_total,
		askDepthTotal: snap.stats.ask_depth_total,
		imbalance: snap.stats.imbalance,
		timestampMs: snap.timestamp_ms
	};
}

function createInitialState(): DepthState {
	return { call: null, put: null, loading: false, error: null };
}

function createDepthStore() {
	const { subscribe, set, update } = writable<DepthState>(createInitialState());

	// Drop a slow response that lands after a newer selection was loaded.
	let generation = 0;

	return {
		subscribe,

		/**
		 * Load the call/put books for one strike. The legs settle independently
		 * so a present book survives its partner's absence; `error` is set only
		 * when both legs fail.
		 */
		async loadBooks(underlying: string, expiration: string, strike: number) {
			const requestGeneration = ++generation;
			// Drop the previous books immediately — a point-in-time view must not
			// keep showing the old selection's depth under the new header.
			set({ call: null, put: null, loading: true, error: null });

			const [callRes, putRes] = await Promise.allSettled([
				api.getOptionSnapshot(underlying, expiration, strike, 'call', DEPTH_LEVELS),
				api.getOptionSnapshot(underlying, expiration, strike, 'put', DEPTH_LEVELS)
			]);
			if (requestGeneration !== generation) return;

			for (const [style, res] of [
				['call', callRes],
				['put', putRes]
			] as const) {
				if (res.status === 'rejected') {
					console.error(
						`Failed to load the ${style} book for ${underlying}/${expiration}/${strike}:`,
						res.reason
					);
				}
			}

			set({
				call: callRes.status === 'fulfilled' ? toBookDepth(callRes.value) : null,
				put: putRes.status === 'fulfilled' ? toBookDepth(putRes.value) : null,
				loading: false,
				error:
					callRes.status === 'rejected' && putRes.status === 'rejected'
						? 'Failed to load order books from the backend.'
						: null
			});
		},

		reset() {
			generation++;
			set(createInitialState());
		}
	};
}

export const depthStore = createDepthStore();
