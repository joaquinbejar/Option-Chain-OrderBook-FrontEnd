import { get, writable } from 'svelte/store';
import { getWebSocketClient, type WsMessage } from '$lib/api/websocket';

export interface SystemState {
	connected: boolean;
	latency: number;
	/**
	 * True when no heartbeat arrived within the staleness window — the last
	 * latency number is no longer trustworthy and must not render as healthy.
	 */
	latencyStale: boolean;
	engineLoad: number;
	lastHeartbeat: number;
}

const CHECK_INTERVAL_MS = 1_000;
/** No heartbeat for this long ⇒ latency is stale (backend beats every few seconds). */
const HEARTBEAT_STALE_MS = 5_000;

function createInitialState(): SystemState {
	return {
		connected: false,
		latency: 0,
		// Stale until the first heartbeat proves otherwise — never show a
		// healthy-looking 0ms before any data arrived.
		latencyStale: true,
		engineLoad: 0,
		lastHeartbeat: 0
	};
}

function createSystemStore() {
	const { subscribe, set, update } = writable<SystemState>(createInitialState());

	let intervalId: ReturnType<typeof setInterval> | null = null;
	let wsUnsubscribe: (() => void) | null = null;

	const handleMessage = (msg: WsMessage) => {
		if (msg.type === 'connected') {
			update((s) => ({ ...s, connected: true }));
		} else if (msg.type === 'heartbeat') {
			const now = Date.now();
			const latency = Math.abs(now - msg.data.timestamp);
			update((s) => ({
				...s,
				latency: Math.min(latency, 999),
				lastHeartbeat: now,
				latencyStale: false
			}));
		}
	};

	return {
		subscribe,

		/**
		 * Start the connection poll and the heartbeat subscription. Idempotent —
		 * a second init while active is a no-op. SSR-safe (no-op on the server).
		 */
		init() {
			if (typeof window === 'undefined' || intervalId !== null) {
				return;
			}
			const ws = getWebSocketClient();

			intervalId = setInterval(() => {
				// Only notify subscribers when something actually changed — the
				// Header re-renders on every store notification, every second,
				// on every route otherwise.
				const s = get({ subscribe });
				const connected = ws.isConnected;
				const latencyStale =
					s.lastHeartbeat === 0 || Date.now() - s.lastHeartbeat > HEARTBEAT_STALE_MS;
				if (connected !== s.connected || latencyStale !== s.latencyStale) {
					update((v) => ({ ...v, connected, latencyStale }));
				}
			}, CHECK_INTERVAL_MS);

			wsUnsubscribe = ws.subscribe(handleMessage);
		},

		/** Tear down the interval and the WS subscription. */
		disconnect() {
			if (intervalId !== null) {
				clearInterval(intervalId);
				intervalId = null;
			}
			if (wsUnsubscribe) {
				wsUnsubscribe();
				wsUnsubscribe = null;
			}
			// Nothing is watching anymore — the store must not keep reporting
			// a healthy connection or a trustworthy latency.
			update((s) => ({ ...s, connected: false, latencyStale: true }));
		},

		setConnected: (connected: boolean) => update((s) => ({ ...s, connected })),
		setLatency: (latency: number) => update((s) => ({ ...s, latency })),
		setEngineLoad: (engineLoad: number) => update((s) => ({ ...s, engineLoad })),
		reset: () => set(createInitialState())
	};
}

export const systemStore = createSystemStore();
