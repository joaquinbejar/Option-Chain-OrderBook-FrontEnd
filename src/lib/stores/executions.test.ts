import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/api/websocket', async (importOriginal) => {
	const real = await importOriginal<typeof import('$lib/api/websocket')>();
	const { makeFakeWsClient } = await import('$lib/__tests__/mocks');
	const fake = makeFakeWsClient();
	return { ...real, getWebSocketClient: () => fake };
});

import { executionsStore, avgEdge, MAX_FILLS } from './executions';
import { getWebSocketClient } from '$lib/api/websocket';
import type { FakeWsClient } from '$lib/__tests__/mocks';

const fakeWs = getWebSocketClient() as unknown as FakeWsClient;

function fillFrame(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		type: 'fill' as const,
		data: {
			order_id: 'o-1',
			symbol: 'BTC',
			instrument: 'BTC-20261218-50000-C',
			side: 'buy',
			quantity: 3,
			price: 1_250,
			edge: 35,
			...overrides
		}
	};
}

beforeEach(() => {
	executionsStore.disconnect(); // drop any subscription left by a previous test
	executionsStore.reset();
	vi.clearAllMocks();
	executionsStore.init();
});

afterEach(() => {
	executionsStore.disconnect();
	vi.restoreAllMocks();
});

describe('executions store', () => {
	it('converts fill price and edge cents to dollars and normalizes the side', () => {
		fakeWs.emit(fillFrame());

		const s = get(executionsStore);
		expect(s.fills).toHaveLength(1);
		expect(s.fills[0]).toMatchObject({
			orderId: 'o-1',
			instrument: 'BTC-20261218-50000-C',
			side: 'BUY',
			quantity: 3,
			price: 12.5,
			edge: 0.35
		});
		expect(s.totalReceived).toBe(1);
	});

	it('prepends new fills (newest first) and ignores other frame types', () => {
		fakeWs.emit(fillFrame({ order_id: 'o-1' }));
		fakeWs.emit({ type: 'price', data: { symbol: 'BTC', price_cents: 1 } });
		fakeWs.emit(fillFrame({ order_id: 'o-2', side: 'sell' }));

		const s = get(executionsStore);
		expect(s.fills.map((f) => f.orderId)).toEqual(['o-2', 'o-1']);
		expect(s.fills[0].side).toBe('SELL');
		expect(s.totalReceived).toBe(2);
	});

	it('caps the list at MAX_FILLS but keeps counting the total', () => {
		for (let i = 0; i < MAX_FILLS + 5; i++) {
			fakeWs.emit(fillFrame({ order_id: `o-${i}` }));
		}

		const s = get(executionsStore);
		expect(s.fills).toHaveLength(MAX_FILLS);
		expect(s.totalReceived).toBe(MAX_FILLS + 5);
		expect(s.fills[0].orderId).toBe(`o-${MAX_FILLS + 4}`); // newest kept
	});

	it('avgEdge averages fills in dollars and is null when empty — never NaN', () => {
		expect(get(avgEdge)).toBeNull();

		fakeWs.emit(fillFrame({ edge: 100 })); // $1.00
		fakeWs.emit(fillFrame({ edge: 300 })); // $3.00

		expect(get(avgEdge)).toBeCloseTo(2);
	});

	it('two fills of the same order in the same instant get distinct row identities', () => {
		fakeWs.emit(fillFrame({ order_id: 'o-partial' }));
		fakeWs.emit(fillFrame({ order_id: 'o-partial' })); // partial fill, same ms

		const s = get(executionsStore);
		expect(s.fills).toHaveLength(2);
		expect(s.fills[0].seq).not.toBe(s.fills[1].seq);
	});

	it('a double init never stacks handlers — one disconnect silences fills', () => {
		executionsStore.init(); // second init on top of beforeEach's
		executionsStore.disconnect();

		fakeWs.emit(fillFrame());
		expect(get(executionsStore).fills).toHaveLength(0);
	});
});
