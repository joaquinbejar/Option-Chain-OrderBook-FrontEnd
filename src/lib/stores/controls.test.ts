import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/api/websocket', async (importOriginal) => {
	const real = await importOriginal<typeof import('$lib/api/websocket')>();
	const { makeFakeWsClient } = await import('$lib/__tests__/mocks');
	const fake = makeFakeWsClient();
	return { ...real, getWebSocketClient: () => fake };
});

vi.mock('$lib/api/client', async (importOriginal) => {
	const real = await importOriginal<typeof import('$lib/api/client')>();
	return {
		...real, // keep ApiError
		api: {
			getControls: vi.fn(),
			listInstruments: vi.fn(),
			killSwitch: vi.fn(),
			enableQuoting: vi.fn(),
			updateParameters: vi.fn(),
			toggleInstrument: vi.fn(),
			cancelAllOrders: vi.fn()
		}
	};
});

import { controlsStore } from './controls';
import { ApiError } from '$lib/api/client';
import { getWebSocketClient } from '$lib/api/websocket';
import { api } from '$lib/api/client';
import type { FakeWsClient } from '$lib/__tests__/mocks';

const fakeWs = getWebSocketClient() as unknown as FakeWsClient;

async function initStore() {
	vi.mocked(api.getControls).mockResolvedValue({
		master_enabled: true,
		spread_multiplier: 1.5,
		size_scalar: 0.8,
		directional_skew: 0.1
	});
	vi.mocked(api.listInstruments).mockResolvedValue({
		instruments: [
			{ symbol: 'BTC', quoting_enabled: true, current_price: 50_000 },
			{ symbol: 'ETH', quoting_enabled: false, current_price: null }
		]
	});
	await controlsStore.init();
}

beforeEach(() => {
	controlsStore.disconnect(); // drop any WS subscription left by a previous test
	controlsStore.reset();
	vi.clearAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks(); // un-spy console.error even if an assertion failed
});

describe('controls store — init', () => {
	it('reflects backend controls and instruments', async () => {
		await initStore();

		const s = get(controlsStore);
		expect(s.masterSwitch).toBe(true);
		expect(s.spreadMultiplier).toBe(1.5);
		expect(s.sizeScalar).toBeCloseTo(80); // size_scalar × 100
		expect(s.directionalSkew).toBe(0.1);
		expect(s.instruments).toHaveLength(2);
		expect(s.instruments[0]).toMatchObject({
			symbol: 'BTC',
			isQuotingEnabled: true,
			currentPrice: 50_000
		});
		expect(s.instruments[1].currentPrice).toBeNull();
		expect(s.loading).toBe(false);
		expect(fakeWs.connect).toHaveBeenCalled();
	});

	it('a failed init clears loading without corrupting defaults', async () => {
		vi.mocked(api.getControls).mockRejectedValue(new Error('backend down'));
		vi.mocked(api.listInstruments).mockRejectedValue(new Error('backend down'));
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await controlsStore.init();

		const s = get(controlsStore);
		expect(s.loading).toBe(false);
		expect(s.masterSwitch).toBe(true);
		expect(s.instruments).toEqual([]);
	});
});

describe('controls store — halt / resume intents', () => {
	it('halt() fires the kill switch and reflects the API result', async () => {
		await initStore();
		vi.mocked(api.killSwitch).mockResolvedValue({
			success: true,
			message: 'killed',
			master_enabled: false
		});

		await controlsStore.halt();

		expect(api.killSwitch).toHaveBeenCalledOnce();
		expect(api.enableQuoting).not.toHaveBeenCalled();
		expect(get(controlsStore).masterSwitch).toBe(false);
	});

	it('resume() re-enables quoting and reflects the API result', async () => {
		await initStore();
		vi.mocked(api.enableQuoting).mockResolvedValue({
			success: true,
			message: 'enabled',
			master_enabled: true
		});

		await controlsStore.resume();

		expect(api.enableQuoting).toHaveBeenCalledOnce();
		expect(api.killSwitch).not.toHaveBeenCalled();
		expect(get(controlsStore).masterSwitch).toBe(true);
	});

	it('halt() never inverts into an enable when state flipped under the dialog', async () => {
		await initStore();
		// Another client halts while the local confirm dialog is open.
		fakeWs.emit({
			type: 'config',
			data: { enabled: false, spread_multiplier: 1.5, size_scalar: 0.8, directional_skew: 0.1 }
		});
		expect(get(controlsStore).masterSwitch).toBe(false);

		vi.mocked(api.killSwitch).mockResolvedValue({
			success: true,
			message: 'killed',
			master_enabled: false
		});

		// The operator's confirmed intent was HALT — it must stay a halt.
		await controlsStore.halt();

		expect(api.killSwitch).toHaveBeenCalledOnce();
		expect(api.enableQuoting).not.toHaveBeenCalled();
	});

	it('ignores a second command while the first is still in flight', async () => {
		await initStore();
		let resolveKill!: (v: { success: boolean; message: string; master_enabled: boolean }) => void;
		vi.mocked(api.killSwitch).mockReturnValue(
			new Promise((resolve) => {
				resolveKill = resolve;
			})
		);

		const first = controlsStore.halt();
		const second = controlsStore.halt(); // double-click on confirm
		const opposite = controlsStore.resume(); // and a stray resume click

		resolveKill({ success: true, message: 'killed', master_enabled: false });
		await Promise.all([first, second, opposite]);

		expect(api.killSwitch).toHaveBeenCalledOnce();
		expect(api.enableQuoting).not.toHaveBeenCalled();
		expect(get(controlsStore).masterSwitch).toBe(false);
	});

	it('keeps the current state when the API call fails — the UI must not lie', async () => {
		await initStore();
		vi.mocked(api.killSwitch).mockRejectedValue(new Error('backend down'));
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await controlsStore.halt();

		expect(get(controlsStore).masterSwitch).toBe(true);
	});

	it('a 403 is reported as a permission denial, not a transient failure', async () => {
		await initStore();
		vi.mocked(api.killSwitch).mockRejectedValue(new ApiError('Forbidden', 403));
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await controlsStore.halt();

		expect(get(controlsStore).masterSwitch).toBe(true);
		expect(get(controlsStore).error).toMatch(/admin token/);
	});
});

describe('controls store — parameters', () => {
	it('setSpreadMultiplier updates optimistically and calls the API with snake_case', async () => {
		await initStore();
		// The POST response echoes size_scalar as a fraction, like GET.
		vi.mocked(api.updateParameters).mockResolvedValue({
			success: true,
			spread_multiplier: 2,
			size_scalar: 0.8,
			directional_skew: 0.1
		});

		await controlsStore.setSpreadMultiplier(2);

		expect(get(controlsStore).spreadMultiplier).toBe(2);
		// snake_case on the wire (backend #81) — camelCase keys are ignored
		// by the backend and would turn the update into a no-op.
		expect(api.updateParameters).toHaveBeenCalledWith({ spread_multiplier: 2 });
	});

	it('reverts the optimistic value and surfaces an error when the backend rejects', async () => {
		await initStore();
		expect(get(controlsStore).spreadMultiplier).toBe(1.5);

		vi.mocked(api.updateParameters).mockRejectedValue(new Error('400 out of range'));
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await controlsStore.setSpreadMultiplier(4.5);

		const s = get(controlsStore);
		expect(s.spreadMultiplier).toBe(1.5); // reverted, not lying
		expect(s.error).toMatch(/spread multiplier/);
	});

	it('adopts the backend echo on success — server-side clamping wins', async () => {
		await initStore();
		vi.mocked(api.updateParameters).mockResolvedValue({
			success: true,
			spread_multiplier: 5, // backend clamped 7 down to its max
			size_scalar: 0.8,
			directional_skew: 0.1
		});

		await controlsStore.setSpreadMultiplier(7);

		const s = get(controlsStore);
		expect(s.spreadMultiplier).toBe(5);
		expect(s.error).toBeNull();
	});

	it('a failed skew update reverts and a later success clears the error', async () => {
		await initStore();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(api.updateParameters).mockRejectedValueOnce(new Error('boom'));

		await controlsStore.setDirectionalSkew(0.9);
		expect(get(controlsStore).directionalSkew).toBe(0.1); // reverted
		expect(get(controlsStore).error).toMatch(/directional skew/);

		vi.mocked(api.updateParameters).mockResolvedValue({
			success: true,
			spread_multiplier: 1.5,
			size_scalar: 0.8,
			directional_skew: 0.5
		});
		await controlsStore.setDirectionalSkew(0.5);

		expect(get(controlsStore).directionalSkew).toBe(0.5);
		expect(get(controlsStore).error).toBeNull();
	});

	it('ignores a stale response that resolves after a newer tick — no backward snap', async () => {
		await initStore();
		vi.spyOn(console, 'error').mockImplementation(() => {});

		type Echo = {
			success: boolean;
			spread_multiplier: number;
			size_scalar: number;
			directional_skew: number;
		};
		let rejectFirst!: (e: Error) => void;
		vi.mocked(api.updateParameters)
			.mockReturnValueOnce(
				new Promise<Echo>((_, reject) => {
					rejectFirst = reject;
				})
			)
			.mockResolvedValueOnce({
				success: true,
				spread_multiplier: 2.5,
				size_scalar: 0.8,
				directional_skew: 0.1
			});

		const first = controlsStore.setSpreadMultiplier(2.0); // will fail late
		const second = controlsStore.setSpreadMultiplier(2.5); // confirms first
		await second;
		rejectFirst(new Error('slow failure of the superseded tick'));
		await first;

		const s = get(controlsStore);
		expect(s.spreadMultiplier).toBe(2.5); // stale failure did not revert or error
		expect(s.error).toBeNull();
	});

	it('a failing update reverts only its own field, never a concurrent one', async () => {
		await initStore();
		vi.spyOn(console, 'error').mockImplementation(() => {});

		type Echo = {
			success: boolean;
			spread_multiplier: number;
			size_scalar: number;
			directional_skew: number;
		};
		let rejectSpread!: (e: Error) => void;
		vi.mocked(api.updateParameters)
			.mockReturnValueOnce(
				new Promise<Echo>((_, reject) => {
					rejectSpread = reject;
				})
			)
			.mockResolvedValueOnce({
				success: true,
				spread_multiplier: 1.5,
				size_scalar: 0.5,
				directional_skew: 0.1
			});

		const spread = controlsStore.setSpreadMultiplier(3.0); // in flight, will fail
		const size = controlsStore.setSizeScalar(50); // concurrent, succeeds
		await size;
		rejectSpread(new Error('backend rejected the spread'));
		await spread;

		const s = get(controlsStore);
		expect(s.spreadMultiplier).toBe(1.5); // reverted to its own snapshot
		expect(s.sizeScalar).toBe(50); // untouched by the spread revert
		expect(s.error).toMatch(/spread multiplier/);
	});

	it('clearError() dismisses a surfaced failure', async () => {
		await initStore();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(api.updateParameters).mockRejectedValue(new Error('boom'));

		await controlsStore.setSizeScalar(10);
		expect(get(controlsStore).error).not.toBeNull();
		expect(get(controlsStore).sizeScalar).toBeCloseTo(80); // reverted

		controlsStore.clearError();
		expect(get(controlsStore).error).toBeNull();
	});

	it('size_scalar round-trips the fraction form: read 0.5, write 0.5 (backend #82)', async () => {
		// GET /controls returned 0.8 (fraction) — the store holds 80 (percent),
		// with float noise (0.8 × 100 = 80.00000000000001) sanitized away.
		await initStore();
		expect(get(controlsStore).sizeScalar).toBe(80);

		// The POST response echoes the fraction, same form as GET.
		vi.mocked(api.updateParameters).mockResolvedValue({
			success: true,
			spread_multiplier: 1.5,
			size_scalar: 0.6,
			directional_skew: 0.1
		});

		// UI slider speaks percent; the wire carries the fraction.
		await controlsStore.setSizeScalar(60);

		expect(api.updateParameters).toHaveBeenCalledWith({ size_scalar: 0.6 });
		expect(get(controlsStore).sizeScalar).toBe(60);
	});

	it('an out-of-range 400 reverts and surfaces the backend message', async () => {
		await initStore();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(api.updateParameters).mockRejectedValue(
			new ApiError('size_scalar must be between 0 and 1', 400)
		);

		await controlsStore.setSizeScalar(150);

		const s = get(controlsStore);
		expect(s.sizeScalar).toBe(80); // reverted to the pre-click value
		expect(s.error).toMatch(/size_scalar must be between 0 and 1/);
	});
});

describe('controls store — instruments', () => {
	it('toggleInstrument flips only the targeted instrument from the API result', async () => {
		await initStore();
		vi.mocked(api.toggleInstrument).mockResolvedValue({
			success: true,
			symbol: 'BTC',
			enabled: false
		});

		await controlsStore.toggleInstrument('BTC');

		const s = get(controlsStore);
		expect(s.instruments.find((i) => i.symbol === 'BTC')?.isQuotingEnabled).toBe(false);
		expect(s.instruments.find((i) => i.symbol === 'ETH')?.isQuotingEnabled).toBe(false); // untouched
	});
});

describe('controls store — subscription lifecycle', () => {
	it('a stale init response never overwrites a newer session', async () => {
		type Controls = {
			master_enabled: boolean;
			spread_multiplier: number;
			size_scalar: number;
			directional_skew: number;
		};
		let resolveStale!: (v: Controls) => void;
		vi.mocked(api.getControls)
			.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveStale = resolve;
				})
			)
			.mockResolvedValueOnce({
				master_enabled: true,
				spread_multiplier: 2.5,
				size_scalar: 0.5,
				directional_skew: 0
			});
		vi.mocked(api.listInstruments).mockResolvedValue({ instruments: [] });

		const stale = controlsStore.init(); // session A, hangs
		controlsStore.disconnect(); // session A drops
		await controlsStore.init(); // session B lands
		expect(get(controlsStore).spreadMultiplier).toBe(2.5);

		resolveStale({
			master_enabled: false,
			spread_multiplier: 9,
			size_scalar: 0.1,
			directional_skew: 1
		});
		await stale;

		// Session A's late response was dropped.
		expect(get(controlsStore).spreadMultiplier).toBe(2.5);
		expect(get(controlsStore).masterSwitch).toBe(true);
	});

	it('a double init never stacks handlers — one disconnect silences all frames', async () => {
		await initStore();
		await initStore(); // remount / re-init must replace, not accumulate

		controlsStore.disconnect();

		fakeWs.emit({
			type: 'config',
			data: { enabled: false, spread_multiplier: 9, size_scalar: 0.1, directional_skew: 1 }
		});

		const s = get(controlsStore);
		expect(s.masterSwitch).toBe(true); // a leaked handler would have applied the frame
		expect(s.spreadMultiplier).toBe(1.5);
	});

	it('disconnect() stops WS frames from mutating state', async () => {
		await initStore();
		controlsStore.disconnect();

		fakeWs.emit({ type: 'price', data: { symbol: 'BTC', price_cents: 1 } });

		expect(get(controlsStore).instruments.find((i) => i.symbol === 'BTC')?.currentPrice).toBe(
			50_000
		);
	});
});

describe('controls store — cancel all orders', () => {
	it('reports the canceled and failed counts as a notice', async () => {
		await initStore();
		vi.mocked(api.cancelAllOrders).mockResolvedValue({ canceled_count: 12, failed_count: 0 });

		await controlsStore.cancelAllOrders();

		expect(api.cancelAllOrders).toHaveBeenCalledOnce();
		expect(get(controlsStore).notice).toBe('Canceled 12 open orders.');
		expect(get(controlsStore).error).toBeNull();
	});

	it('a partial failure is an alert, never a green notice — orders are still live', async () => {
		await initStore();
		vi.mocked(api.cancelAllOrders).mockResolvedValue({ canceled_count: 10, failed_count: 2 });

		await controlsStore.cancelAllOrders();

		const s = get(controlsStore);
		expect(s.notice).toBeNull();
		expect(s.error).toMatch(/2 FAILED to cancel and are still live/);
	});

	it('a 403 is a trade-permission denial, not a transient failure', async () => {
		await initStore();
		vi.mocked(api.cancelAllOrders).mockRejectedValue(new ApiError('Forbidden', 403));
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await controlsStore.cancelAllOrders();

		expect(get(controlsStore).error).toMatch(/trade token/);
		expect(get(controlsStore).notice).toBeNull();
	});

	it('passes scope filters through to the API and names the scope in the notice', async () => {
		await initStore();
		vi.mocked(api.cancelAllOrders).mockResolvedValue({ canceled_count: 4, failed_count: 0 });

		await controlsStore.cancelAllOrders({
			underlying: 'BTC',
			expiration: '20260821',
			side: 'buy',
			style: 'call'
		});

		// The filters reach the wire untouched — the backend applies them.
		expect(api.cancelAllOrders).toHaveBeenCalledWith({
			underlying: 'BTC',
			expiration: '20260821',
			side: 'buy',
			style: 'call'
		});
		expect(get(controlsStore).notice).toBe(
			'Canceled 4 open orders matching buy calls on BTC expiring 20260821.'
		);
	});

	it('an empty filter object stays an unscoped cancel-all', async () => {
		await initStore();
		vi.mocked(api.cancelAllOrders).mockResolvedValue({ canceled_count: 7, failed_count: 0 });

		await controlsStore.cancelAllOrders({});

		expect(get(controlsStore).notice).toBe('Canceled 7 open orders.');
	});

	it('a zero-match scoped cancel is reported as a no-match, not a success', async () => {
		await initStore();
		vi.mocked(api.cancelAllOrders).mockResolvedValue({ canceled_count: 0, failed_count: 0 });

		// Expiration with no underlying spans every product — the scope text
		// must say so (it is what the operator authorized).
		await controlsStore.cancelAllOrders({ expiration: '20260821' });

		expect(get(controlsStore).notice).toBe(
			'No open orders matching expiring 20260821 across all underlyings — nothing was canceled.'
		);
		expect(get(controlsStore).error).toBeNull();
	});

	it('a zero-match unscoped cancel says the book was already clear', async () => {
		await initStore();
		vi.mocked(api.cancelAllOrders).mockResolvedValue({ canceled_count: 0, failed_count: 0 });

		await controlsStore.cancelAllOrders();

		expect(get(controlsStore).notice).toBe('No open orders to cancel.');
	});

	it('an invalid-filter 400 surfaces the backend message', async () => {
		await initStore();
		vi.mocked(api.cancelAllOrders).mockRejectedValue(
			new ApiError("Invalid side: middle. Use 'buy' or 'sell'", 400)
		);
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await controlsStore.cancelAllOrders({ side: 'buy' });

		expect(get(controlsStore).error).toMatch(/Invalid side: middle/);
		expect(get(controlsStore).notice).toBeNull();
	});

	it('ignores a second click while the first command is in flight', async () => {
		await initStore();
		let resolveCancel!: (v: { canceled_count: number; failed_count: number }) => void;
		vi.mocked(api.cancelAllOrders).mockReturnValue(
			new Promise((resolve) => {
				resolveCancel = resolve;
			})
		);

		const first = controlsStore.cancelAllOrders();
		const second = controlsStore.cancelAllOrders(); // double-fire
		resolveCancel({ canceled_count: 3, failed_count: 0 });
		await Promise.all([first, second]);

		expect(api.cancelAllOrders).toHaveBeenCalledOnce();
	});
});

describe('controls store — WebSocket frames', () => {
	it('a config frame updates the quoting parameters', async () => {
		await initStore();

		fakeWs.emit({
			type: 'config',
			data: { enabled: false, spread_multiplier: 3, size_scalar: 0.5, directional_skew: -0.2 }
		});

		const s = get(controlsStore);
		expect(s.masterSwitch).toBe(false);
		expect(s.spreadMultiplier).toBe(3);
		expect(s.sizeScalar).toBeCloseTo(50);
		expect(s.directionalSkew).toBe(-0.2);
	});

	it('a price frame converts cents to dollars for the matching instrument only', async () => {
		await initStore();

		fakeWs.emit({ type: 'price', data: { symbol: 'BTC', price_cents: 5_100_000 } });

		const s = get(controlsStore);
		expect(s.instruments.find((i) => i.symbol === 'BTC')?.currentPrice).toBe(51_000);
		expect(s.instruments.find((i) => i.symbol === 'ETH')?.currentPrice).toBeNull();
	});
});
