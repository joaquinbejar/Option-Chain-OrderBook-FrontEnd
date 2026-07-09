import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/api/client', () => ({
	api: {
		getOptionSnapshot: vi.fn()
	}
}));

import { depthStore, toBookDepth, DEPTH_LEVELS } from './depth';
import { api, type EnrichedSnapshotResponse } from '$lib/api/client';

function snapshot(overrides: Partial<EnrichedSnapshotResponse> = {}): EnrichedSnapshotResponse {
	return {
		symbol: 'BTC-20261218-50000-C',
		sequence: 1,
		timestamp_ms: 1_000,
		bids: [
			{ price: 1_200, quantity: 5, order_count: 2 },
			{ price: 1_150, quantity: 8, order_count: 1 }
		],
		asks: [
			{ price: 1_300, quantity: 4, order_count: 1 },
			{ price: 1_350, quantity: 6, order_count: 3 }
		],
		stats: {
			mid_price: 1_250,
			spread_bps: 800,
			bid_depth_total: 13,
			ask_depth_total: 10,
			imbalance: 0.13,
			vwap_bid: 1_180,
			vwap_ask: 1_330
		},
		...overrides
	};
}

beforeEach(() => {
	depthStore.reset();
	vi.clearAllMocks();
});

describe('toBookDepth', () => {
	it('converts level cents to dollars exactly once and accumulates totals', () => {
		const book = toBookDepth(snapshot());

		expect(book.bids[0]).toEqual({ price: 12, size: 5, total: 5, orderCount: 2 });
		expect(book.bids[1]).toEqual({ price: 11.5, size: 8, total: 13, orderCount: 1 });
		expect(book.asks[1].total).toBe(10);
		expect(book.bidDepthTotal).toBe(13);
		expect(book.askDepthTotal).toBe(10);
	});

	it('derives the dollar spread locally and the percent from backend spread_bps', () => {
		const book = toBookDepth(snapshot());

		expect(book.spread).toBeCloseTo(1); // 13 − 12
		expect(book.spreadPercent).toBeCloseTo(8); // 800 bps
		expect(book.timestampMs).toBe(1_000);
	});

	it('falls back to a locally computed percent when spread_bps is null', () => {
		const base = snapshot();
		const book = toBookDepth({ ...base, stats: { ...base.stats, spread_bps: null } });

		expect(book.spreadPercent).toBeCloseTo(8); // 1 / 12.5 × 100
	});

	it('reports a null spread for a one-sided or empty book — never 0 or NaN', () => {
		const oneSided = toBookDepth(snapshot({ asks: [] }));
		expect(oneSided.spread).toBeNull();
		expect(oneSided.spreadPercent).toBeNull();

		const empty = toBookDepth(snapshot({ bids: [], asks: [] }));
		expect(empty.spread).toBeNull();
		expect(empty.bids).toEqual([]);
	});
});

describe('depthStore.loadBooks', () => {
	it('loads both styles and exposes transformed books', async () => {
		vi.mocked(api.getOptionSnapshot).mockResolvedValue(snapshot());

		await depthStore.loadBooks('BTC', '2026-12-18', 5_000_000);

		expect(api.getOptionSnapshot).toHaveBeenCalledWith(
			'BTC',
			'2026-12-18',
			5_000_000,
			'call',
			DEPTH_LEVELS
		);
		expect(api.getOptionSnapshot).toHaveBeenCalledWith(
			'BTC',
			'2026-12-18',
			5_000_000,
			'put',
			DEPTH_LEVELS
		);

		const s = get(depthStore);
		expect(s.call?.bids[0].price).toBe(12);
		expect(s.put).not.toBeNull();
		expect(s.loading).toBe(false);
		expect(s.error).toBeNull();
	});

	it('keeps a present book when only the other leg fails', async () => {
		vi.mocked(api.getOptionSnapshot)
			.mockResolvedValueOnce(snapshot()) // call leg
			.mockRejectedValueOnce(new Error('404 put book not found'));
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await depthStore.loadBooks('BTC', '2026-12-18', 5_000_000);

		const s = get(depthStore);
		expect(s.call).not.toBeNull();
		expect(s.put).toBeNull();
		expect(s.error).toBeNull(); // one honest empty panel, not a page-wide failure
		vi.restoreAllMocks();
	});

	it('surfaces a failure as an error state with no fabricated books', async () => {
		vi.mocked(api.getOptionSnapshot).mockRejectedValue(new Error('404 strike not found'));
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await depthStore.loadBooks('BTC', '2026-12-18', 5_000_000);

		const s = get(depthStore);
		expect(s.call).toBeNull();
		expect(s.put).toBeNull();
		expect(s.error).toMatch(/order books/i);
		expect(s.loading).toBe(false);
		vi.restoreAllMocks();
	});

	it('ignores a stale response that resolves after a newer selection', async () => {
		let resolveFirstCall!: (v: EnrichedSnapshotResponse) => void;
		let resolveFirstPut!: (v: EnrichedSnapshotResponse) => void;
		vi.mocked(api.getOptionSnapshot)
			.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveFirstCall = resolve;
				})
			)
			.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveFirstPut = resolve;
				})
			)
			.mockResolvedValue(snapshot({ symbol: 'NEWER' }));

		const first = depthStore.loadBooks('BTC', '2026-12-18', 1_000_00);
		const second = depthStore.loadBooks('BTC', '2026-12-18', 2_000_00);
		await second;

		resolveFirstCall(snapshot({ symbol: 'STALE' }));
		resolveFirstPut(snapshot({ symbol: 'STALE' }));
		await first;

		expect(get(depthStore).call?.symbol).toBe('NEWER');
	});
});
