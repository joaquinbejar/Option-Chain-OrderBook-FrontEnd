import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/api/websocket', async (importOriginal) => {
	const real = await importOriginal<typeof import('$lib/api/websocket')>();
	const { makeFakeWsClient } = await import('$lib/__tests__/mocks');
	const fake = makeFakeWsClient();
	return { ...real, getWebSocketClient: () => fake };
});

import { depthStore, projectBook, DEPTH_LEVELS, MAX_TAPE_TRADES } from './depth';
import { getWebSocketClient, type WsMessage } from '$lib/api/websocket';
import type { FakeWsClient } from '$lib/__tests__/mocks';

const fakeWs = getWebSocketClient() as unknown as FakeWsClient;

const CALL = 'BTC-20261218-5000000-C';
const PUT = 'BTC-20261218-5000000-P';

function snapshotFrame(
	symbol: string,
	sequence: number,
	bids: Array<[number, number]>,
	asks: Array<[number, number]>
): WsMessage {
	return {
		type: 'orderbook_snapshot',
		data: {
			channel: 'orderbook',
			symbol,
			sequence,
			bids: bids.map(([price, quantity]) => ({ price, quantity })),
			asks: asks.map(([price, quantity]) => ({ price, quantity }))
		}
	};
}

function deltaFrame(
	symbol: string,
	sequence: number,
	changes: Array<{ side: 'bid' | 'ask'; price: number; quantity: number }>
): WsMessage {
	return { type: 'orderbook_delta', data: { symbol, sequence, changes } };
}

beforeEach(() => {
	depthStore.reset();
	vi.clearAllMocks();
});

describe('projectBook', () => {
	it('converts level cents to dollars exactly once and accumulates totals', () => {
		const book = projectBook(
			CALL,
			{
				bids: new Map([
					[1_200, 5],
					[1_150, 8]
				]),
				asks: new Map([
					[1_300, 4],
					[1_350, 6]
				])
			},
			1_000
		);

		expect(book.bids[0]).toEqual({ price: 12, size: 5, total: 5 });
		expect(book.bids[1]).toEqual({ price: 11.5, size: 8, total: 13 });
		expect(book.asks[1].total).toBe(10);
		expect(book.bidDepthTotal).toBe(13);
		expect(book.askDepthTotal).toBe(10);
		expect(book.imbalance).toBeCloseTo(3 / 23);
		expect(book.updatedMs).toBe(1_000);
	});

	it('sorts bids descending and asks ascending regardless of input order', () => {
		const book = projectBook(
			CALL,
			{
				bids: new Map([
					[1_150, 8],
					[1_200, 5]
				]),
				asks: new Map([
					[1_350, 6],
					[1_300, 4]
				])
			},
			0
		);

		expect(book.bids.map((l) => l.price)).toEqual([12, 11.5]);
		expect(book.asks.map((l) => l.price)).toEqual([13, 13.5]);
		expect(book.spread).toBeCloseTo(1);
		expect(book.spreadPercent).toBeCloseTo(8); // 1 / 12.5 × 100
	});

	it('caps each side at DEPTH_LEVELS', () => {
		const bids = new Map(Array.from({ length: 15 }, (_, i) => [2_000 - i, 1] as [number, number]));
		const book = projectBook(CALL, { bids, asks: new Map() }, 0);

		expect(book.bids).toHaveLength(DEPTH_LEVELS);
		expect(book.bids[0].price).toBe(20); // best kept, tail trimmed
	});

	it('reports a null spread for a one-sided or empty book — never 0 or NaN', () => {
		const oneSided = projectBook(CALL, { bids: new Map([[1_200, 5]]), asks: new Map() }, 0);
		expect(oneSided.spread).toBeNull();
		expect(oneSided.spreadPercent).toBeNull();

		const empty = projectBook(CALL, { bids: new Map(), asks: new Map() }, 0);
		expect(empty.spread).toBeNull();
		expect(empty.bids).toEqual([]);
		expect(empty.imbalance).toBe(0);
	});
});

describe('depthStore — selection and snapshots', () => {
	it('select() subscribes both legs to orderbook and trades channels', () => {
		depthStore.select('BTC', '20261218', 5_000_000);

		expect(fakeWs.subscribeOrderbook).toHaveBeenCalledWith(CALL, DEPTH_LEVELS);
		expect(fakeWs.subscribeOrderbook).toHaveBeenCalledWith(PUT, DEPTH_LEVELS);
		expect(fakeWs.subscribeTrades).toHaveBeenCalledWith(CALL);
		expect(fakeWs.subscribeTrades).toHaveBeenCalledWith(PUT);
		expect(get(depthStore).loading).toBe(true);
	});

	it('a snapshot paints its leg and marks the view live', () => {
		depthStore.select('BTC', '20261218', 5_000_000);
		fakeWs.emit(snapshotFrame(CALL, 1, [[1_200, 5]], [[1_300, 4]]));

		const s = get(depthStore);
		expect(s.call?.bids[0]).toEqual({ price: 12, size: 5, total: 5 });
		expect(s.put).toBeNull(); // the other leg waits for its own snapshot
		expect(s.live).toBe(true);
		expect(s.loading).toBe(false);
	});

	it('ignores frames for instruments that are not the current selection', () => {
		depthStore.select('BTC', '20261218', 5_000_000);
		fakeWs.emit(snapshotFrame('ETH-20261218-300000-C', 1, [[100, 1]], []));

		const s = get(depthStore);
		expect(s.call).toBeNull();
		expect(s.put).toBeNull();
	});

	it('reselecting unsubscribes the previous symbols', () => {
		depthStore.select('BTC', '20261218', 5_000_000);
		depthStore.select('BTC', '20261218', 6_000_000);

		expect(fakeWs.unsubscribeOrderbook).toHaveBeenCalledWith(CALL);
		expect(fakeWs.unsubscribeOrderbook).toHaveBeenCalledWith(PUT);
		expect(fakeWs.unsubscribeTrades).toHaveBeenCalledWith(CALL);
		expect(fakeWs.unsubscribeTrades).toHaveBeenCalledWith(PUT);
	});
});

describe('depthStore — deltas', () => {
	beforeEach(() => {
		depthStore.select('BTC', '20261218', 5_000_000);
		fakeWs.emit(
			snapshotFrame(
				CALL,
				10,
				[
					[1_200, 5],
					[1_150, 8]
				],
				[[1_300, 4]]
			)
		);
	});

	it('applies an in-order delta: update, insert, and remove-at-zero', () => {
		fakeWs.emit(
			deltaFrame(CALL, 11, [
				{ side: 'bid', price: 1_200, quantity: 9 }, // update
				{ side: 'ask', price: 1_250, quantity: 3 }, // insert (new best ask)
				{ side: 'bid', price: 1_150, quantity: 0 } // remove
			])
		);

		const book = get(depthStore).call;
		expect(book?.bids).toEqual([{ price: 12, size: 9, total: 9 }]);
		expect(book?.asks[0]).toEqual({ price: 12.5, size: 3, total: 3 });
		expect(book?.spread).toBeCloseTo(0.5);
	});

	it('drops a stale or duplicate delta', () => {
		fakeWs.emit(deltaFrame(CALL, 10, [{ side: 'bid', price: 1_200, quantity: 1 }]));

		expect(get(depthStore).call?.bids[0].size).toBe(5); // unchanged
	});

	it('a sequence gap triggers a resync and stops applying deltas until the snapshot', () => {
		fakeWs.emit(deltaFrame(CALL, 13, [{ side: 'bid', price: 1_200, quantity: 1 }]));

		expect(fakeWs.resyncOrderbook).toHaveBeenCalledWith(CALL);
		expect(get(depthStore).call?.bids[0].size).toBe(5); // gap frame not applied
		// A resyncing ladder must not read as live.
		expect(get(depthStore).live).toBe(false);
		expect(get(depthStore).loading).toBe(true);

		// A follow-up delta before the fresh snapshot must also be ignored.
		fakeWs.emit(deltaFrame(CALL, 14, [{ side: 'bid', price: 1_200, quantity: 2 }]));
		expect(get(depthStore).call?.bids[0].size).toBe(5);

		// The fresh snapshot re-bases the stream and restores the live state.
		fakeWs.emit(snapshotFrame(CALL, 15, [[1_200, 7]], []));
		expect(get(depthStore).call?.bids[0].size).toBe(7);
		expect(get(depthStore).live).toBe(true);
		expect(get(depthStore).loading).toBe(false);
		fakeWs.emit(deltaFrame(CALL, 16, [{ side: 'bid', price: 1_200, quantity: 8 }]));
		expect(get(depthStore).call?.bids[0].size).toBe(8);
	});

	it('caps the raw accumulation of delta-created levels, keeping the best-priced', () => {
		// 60 distinct bid levels stream in below the snapshot's 1200/1150; the
		// raw side must stay bounded and the ladder must still show the best
		// DEPTH_LEVELS (snapshot levels included — eviction drops the worst).
		for (let i = 0; i < 60; i++) {
			fakeWs.emit(deltaFrame(CALL, 11 + i, [{ side: 'bid', price: 100 + i, quantity: 1 }]));
		}
		const book = get(depthStore).call;
		expect(book?.bids).toHaveLength(DEPTH_LEVELS);
		expect(book?.bids[0].price).toBe(12); // snapshot's best bid survives eviction
		expect(book?.bids[2].price).toBeCloseTo(1.59); // then the best delta'd level
	});

	it('a delta before any snapshot is ignored', () => {
		fakeWs.emit(deltaFrame(PUT, 1, [{ side: 'bid', price: 900, quantity: 2 }]));

		expect(get(depthStore).put).toBeNull();
	});
});

describe('depthStore — trades tape', () => {
	beforeEach(() => {
		depthStore.select('BTC', '20261218', 5_000_000);
	});

	const tradeFrame = (symbol: string, id: string, price: number): WsMessage => ({
		type: 'trade',
		data: {
			trade_id: id,
			symbol,
			price,
			quantity: 2,
			timestamp_ms: 1_700_000_000_000,
			maker_order_id: 'm1',
			taker_order_id: 't1'
		}
	});

	it('prepends trades for either leg with cents converted to dollars', () => {
		fakeWs.emit(tradeFrame(CALL, 'a', 1_250));
		fakeWs.emit(tradeFrame(PUT, 'b', 900));

		const trades = get(depthStore).trades;
		expect(trades).toHaveLength(2);
		expect(trades[0]).toMatchObject({ tradeId: 'b', leg: 'PUT', price: 9 });
		expect(trades[1]).toMatchObject({ tradeId: 'a', leg: 'CALL', price: 12.5 });
	});

	it('drops a redelivered trade_id — a reconnect replay must not double-print', () => {
		fakeWs.emit(tradeFrame(CALL, 'dup', 1_250));
		fakeWs.emit(tradeFrame(CALL, 'dup', 1_250));

		expect(get(depthStore).trades).toHaveLength(1);
	});

	it('ignores trades for other instruments and caps the tape', () => {
		fakeWs.emit(tradeFrame('ETH-20261218-300000-C', 'x', 100));
		expect(get(depthStore).trades).toHaveLength(0);

		for (let i = 0; i < MAX_TAPE_TRADES + 5; i++) {
			fakeWs.emit(tradeFrame(CALL, `t${i}`, 1_000 + i));
		}
		const trades = get(depthStore).trades;
		expect(trades).toHaveLength(MAX_TAPE_TRADES);
		expect(trades[0].tradeId).toBe(`t${MAX_TAPE_TRADES + 4}`); // newest first
	});
});

describe('depthStore — stream errors', () => {
	it('surfaces a WS error while waiting for the snapshots', () => {
		depthStore.select('BTC', '20261218', 5_000_000);
		fakeWs.emit({ type: 'error', data: { message: 'Invalid symbol format: BTC-x' } });

		const s = get(depthStore);
		expect(s.error).toBe('Invalid symbol format: BTC-x');
		expect(s.loading).toBe(false);
	});

	it('ignores unrelated WS errors once the view is live', () => {
		depthStore.select('BTC', '20261218', 5_000_000);
		fakeWs.emit(snapshotFrame(CALL, 1, [[1_200, 5]], []));
		fakeWs.emit({ type: 'error', data: { message: 'forbidden: admin permission required' } });

		expect(get(depthStore).error).toBeNull();
	});
});

describe('depthStore — teardown', () => {
	it('reset() unsubscribes symbols, drops the handler, and clears state', () => {
		depthStore.select('BTC', '20261218', 5_000_000);
		fakeWs.emit(snapshotFrame(CALL, 1, [[1_200, 5]], []));

		depthStore.reset();

		expect(fakeWs.unsubscribeOrderbook).toHaveBeenCalledWith(CALL);
		expect(fakeWs.unsubscribeTrades).toHaveBeenCalledWith(PUT);
		const s = get(depthStore);
		expect(s.call).toBeNull();
		expect(s.live).toBe(false);
		expect(s.trades).toEqual([]);

		// A frame after reset must not resurrect state through a leaked handler.
		fakeWs.emit(snapshotFrame(CALL, 2, [[1_200, 5]], []));
		expect(get(depthStore).call).toBeNull();
	});
});
