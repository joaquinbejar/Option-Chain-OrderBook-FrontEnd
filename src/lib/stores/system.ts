import { writable } from 'svelte/store';
import { getWebSocketClient, type WsMessage } from '$lib/api/websocket';

export interface SystemState {
	connected: boolean;
	latency: number;
	engineLoad: number;
	lastHeartbeat: number;
}

function createSystemStore() {
	const { subscribe, set, update } = writable<SystemState>({
		connected: false,
		latency: 0,
		engineLoad: 0,
		lastHeartbeat: 0
	});

	// Track WebSocket connection and heartbeats
	if (typeof window !== 'undefined') {
		const ws = getWebSocketClient();
		
		// Check connection status periodically
		setInterval(() => {
			update((s) => ({ ...s, connected: ws.isConnected }));
		}, 1000);

		ws.subscribe((msg: WsMessage) => {
			if (msg.type === 'connected') {
				update((s) => ({ ...s, connected: true }));
			} else if (msg.type === 'heartbeat') {
				const now = Date.now();
				const serverTime = msg.data.timestamp;
				const latency = Math.abs(now - serverTime);
				update((s) => ({
					...s,
					latency: Math.min(latency, 999),
					lastHeartbeat: now
				}));
			}
		});
	}

	return {
		subscribe,
		setConnected: (connected: boolean) => update((s) => ({ ...s, connected })),
		setLatency: (latency: number) => update((s) => ({ ...s, latency })),
		setEngineLoad: (engineLoad: number) => update((s) => ({ ...s, engineLoad })),
		reset: () =>
			set({
				connected: false,
				latency: 0,
				engineLoad: 0,
				lastHeartbeat: 0
			})
	};
}

export const systemStore = createSystemStore();
