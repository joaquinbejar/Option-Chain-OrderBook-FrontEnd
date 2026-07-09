import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/api/websocket', async (importOriginal) => {
	const real = await importOriginal<typeof import('$lib/api/websocket')>();
	const { makeFakeWsClient } = await import('$lib/__tests__/mocks');
	const fake = makeFakeWsClient();
	return { ...real, getWebSocketClient: () => fake };
});

vi.mock('$lib/api/client', () => ({
	api: {
		listUnderlyings: vi.fn(),
		getAllPrices: vi.fn(),
		listExpirations: vi.fn(),
		listStrikes: vi.fn()
	}
}));

import { marketStore } from './market';
import { getWebSocketClient } from '$lib/api/websocket';
import { api } from '$lib/api/client';
import type { FakeWsClient } from '$lib/__tests__/mocks';

const fakeWs = getWebSocketClient() as unknown as FakeWsClient;

beforeEach(() => {
	marketStore.disconnect(); // drop any WS subscription left by a previous test
	marketStore.reset();
	vi.clearAllMocks();
});

describe('market store — price frames', () => {
	it('converts price_cents to dollars exactly once', () => {
		marketStore.handleWsMessage({ type: 'price', data: { symbol: 'BTC', price_cents: 5_000_000 } });

		const p = get(marketStore).prices.get('BTC');
		expect(p?.price).toBe(50_000);
		expect(p?.priceCents).toBe(5_000_000);
	});

	it('computes change and changePercent against the previous tick', () => {
		marketStore.handleWsMessage({ type: 'price', data: { symbol: 'BTC', price_cents: 5_000_000 } });
		marketStore.handleWsMessage({ type: 'price', data: { symbol: 'BTC', price_cents: 5_050_000 } });

		const p = get(marketStore).prices.get('BTC');
		expect(p?.previousPrice).toBe(50_000);
		expect(p?.change).toBeCloseTo(500);
		expect(p?.changePercent).toBeCloseTo(1);
	});

	it('reports zero change on the first tick', () => {
		marketStore.handleWsMessage({ type: 'price', data: { symbol: 'ETH', price_cents: 300_000 } });

		const p = get(marketStore).prices.get('ETH');
		expect(p?.change).toBe(0);
		expect(p?.changePercent).toBe(0);
	});

	it('guards changePercent against a zero previous price — no NaN/Infinity', () => {
		marketStore.handleWsMessage({ type: 'price', data: { symbol: 'ETH', price_cents: 0 } });
		marketStore.handleWsMessage({ type: 'price', data: { symbol: 'ETH', price_cents: 100 } });

		const p = get(marketStore).prices.get('ETH');
		expect(p?.change).toBe(1);
		expect(p?.changePercent).toBe(0);
		expect(Number.isFinite(p?.changePercent)).toBe(true);
	});
});

describe('market store — quote frames', () => {
	const frame = {
		type: 'quote' as const,
		data: {
			symbol: 'BTC',
			expiration: '2026-12-18',
			strike: 50_000,
			style: 'call',
			bid_price: 1_200,
			ask_price: 1_300,
			bid_size: 10,
			ask_size: 8
		}
	};

	it('converts bid/ask cents to dollars and derives spread', () => {
		marketStore.handleWsMessage(frame);

		const q = marketStore.getQuote('BTC', '2026-12-18', 50_000, 'call');
		expect(q?.bidPrice).toBe(12);
		expect(q?.askPrice).toBe(13);
		expect(q?.bidSize).toBe(10);
		expect(q?.askSize).toBe(8);
		expect(q?.spread).toBeCloseTo(1);
		expect(q?.spreadPercent).toBeCloseTo(8); // 1 / 12.5 * 100
	});

	it('guards spreadPercent against a zero mid price — no NaN/Infinity', () => {
		marketStore.handleWsMessage({
			...frame,
			data: { ...frame.data, bid_price: 0, ask_price: 0 }
		});

		const q = marketStore.getQuote('BTC', '2026-12-18', 50_000, 'call');
		expect(q?.spreadPercent).toBe(0);
		expect(Number.isFinite(q?.spreadPercent)).toBe(true);
	});
});

describe('market store — lifecycle', () => {
	it('a connected frame marks the store connected', () => {
		marketStore.handleWsMessage({ type: 'connected', data: { message: 'hi' } });
		expect(get(marketStore).connected).toBe(true);
	});

	it('reset() clears previously accumulated prices and quotes', () => {
		marketStore.handleWsMessage({ type: 'price', data: { symbol: 'BTC', price_cents: 100 } });
		marketStore.reset();

		const state = get(marketStore);
		expect(state.prices.size).toBe(0);
		expect(state.quotes.size).toBe(0);
	});

	it('init() loads REST data, connects the WS and subscribes', async () => {
		vi.mocked(api.listUnderlyings).mockResolvedValue({ underlyings: ['BTC'] });
		vi.mocked(api.getAllPrices).mockResolvedValue([
			{ symbol: 'BTC', price: 50_000, bid: null, ask: null, volume: null, timestamp: 't0' }
		]);
		vi.mocked(api.listExpirations).mockResolvedValue({ expirations: ['2026-12-18'] });

		await marketStore.init();

		const state = get(marketStore);
		expect(state.underlyings).toEqual(['BTC']);
		expect(state.prices.get('BTC')?.price).toBe(50_000);
		expect(state.expirations.get('BTC')).toEqual(['2026-12-18']);
		expect(fakeWs.connect).toHaveBeenCalled();
		expect(fakeWs.subscribe).toHaveBeenCalled();
	});

	it('disconnect() unsubscribes from the WS so later frames are ignored', async () => {
		vi.mocked(api.listUnderlyings).mockResolvedValue({ underlyings: [] });
		vi.mocked(api.getAllPrices).mockResolvedValue([]);

		await marketStore.init();
		marketStore.disconnect();

		expect(fakeWs.disconnect).toHaveBeenCalled();
		expect(get(marketStore).connected).toBe(false);

		fakeWs.emit({ type: 'price', data: { symbol: 'BTC', price_cents: 100 } });
		expect(get(marketStore).prices.has('BTC')).toBe(false);
	});

	it('loadStrikes() surfaces a failure as an empty list, not a throw', async () => {
		vi.mocked(api.listStrikes).mockRejectedValue(new Error('boom'));
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(marketStore.loadStrikes('BTC', '2026-12-18')).resolves.toEqual([]);
	});
});
