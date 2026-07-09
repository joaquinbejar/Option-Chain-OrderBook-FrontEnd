import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/api/websocket', async (importOriginal) => {
	const real = await importOriginal<typeof import('$lib/api/websocket')>();
	const { makeFakeWsClient } = await import('$lib/__tests__/mocks');
	const fake = makeFakeWsClient();
	return { ...real, getWebSocketClient: () => fake };
});

import { systemStore } from './system';
import { getWebSocketClient } from '$lib/api/websocket';
import type { FakeWsClient } from '$lib/__tests__/mocks';

const fakeWs = getWebSocketClient() as unknown as FakeWsClient;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(1_000_000);
	systemStore.disconnect(); // drop anything left by a previous test
	systemStore.reset();
	fakeWs.setConnected(true);
	vi.clearAllMocks();
});

afterEach(() => {
	systemStore.disconnect();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('system store — lifecycle', () => {
	it('starts stale: no healthy 0ms before the first heartbeat', () => {
		expect(get(systemStore).latencyStale).toBe(true);
	});

	it('init() opens one interval and one subscription; a second init is a no-op', () => {
		systemStore.init();
		systemStore.init();

		expect(vi.getTimerCount()).toBe(1);
		expect(fakeWs.subscribe).toHaveBeenCalledOnce();
	});

	it('disconnect() clears the interval and unsubscribes', () => {
		systemStore.init();
		systemStore.disconnect();

		expect(vi.getTimerCount()).toBe(0);

		// A frame after disconnect must not mutate state.
		fakeWs.emit({ type: 'heartbeat', data: { timestamp: 999_500 } });
		expect(get(systemStore).lastHeartbeat).toBe(0);
	});

	it('a heartbeat sets latency and clears staleness', () => {
		systemStore.init();

		fakeWs.emit({ type: 'heartbeat', data: { timestamp: 999_940 } });

		const s = get(systemStore);
		expect(s.latency).toBe(60);
		expect(s.latencyStale).toBe(false);
		expect(s.lastHeartbeat).toBe(1_000_000);
	});

	it('marks latency stale when heartbeats stop, and recovers on the next one', () => {
		systemStore.init();
		fakeWs.emit({ type: 'heartbeat', data: { timestamp: 1_000_000 } });
		expect(get(systemStore).latencyStale).toBe(false);

		// Within the window: still fresh.
		vi.advanceTimersByTime(4_000);
		expect(get(systemStore).latencyStale).toBe(false);

		// Past the 5s window: stale, but the last number is preserved.
		vi.advanceTimersByTime(2_000);
		expect(get(systemStore).latencyStale).toBe(true);

		// A new heartbeat immediately clears staleness.
		fakeWs.emit({ type: 'heartbeat', data: { timestamp: Date.now() } });
		expect(get(systemStore).latencyStale).toBe(false);
	});

	it('the poll reflects the WS client connected flag in both directions', () => {
		systemStore.init();
		expect(get(systemStore).connected).toBe(false);

		vi.advanceTimersByTime(1_000);
		expect(get(systemStore).connected).toBe(true); // fake client reports connected

		fakeWs.setConnected(false); // socket drops
		vi.advanceTimersByTime(1_000);
		expect(get(systemStore).connected).toBe(false);
	});

	it('init() after disconnect() resumes updating', () => {
		systemStore.init();
		systemStore.disconnect();
		systemStore.init();

		expect(vi.getTimerCount()).toBe(1);

		fakeWs.emit({ type: 'heartbeat', data: { timestamp: 999_940 } });
		const s = get(systemStore);
		expect(s.latency).toBe(60);
		expect(s.latencyStale).toBe(false);
	});

	it('a connected frame flips connected without waiting for the poll', () => {
		systemStore.init();
		fakeWs.emit({ type: 'connected', data: { message: 'hi' } });
		expect(get(systemStore).connected).toBe(true);
	});

	it('caps displayed latency at 999ms', () => {
		systemStore.init();
		fakeWs.emit({ type: 'heartbeat', data: { timestamp: 1 } });
		expect(get(systemStore).latency).toBe(999);
	});
});
