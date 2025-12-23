import { writable } from 'svelte/store';

export interface SystemState {
	connected: boolean;
	latency: number;
	engineLoad: number;
}

function createSystemStore() {
	const { subscribe, set, update } = writable<SystemState>({
		connected: true,
		latency: 12,
		engineLoad: 34
	});

	return {
		subscribe,
		setConnected: (connected: boolean) => update((s) => ({ ...s, connected })),
		setLatency: (latency: number) => update((s) => ({ ...s, latency })),
		setEngineLoad: (engineLoad: number) => update((s) => ({ ...s, engineLoad })),
		reset: () =>
			set({
				connected: true,
				latency: 12,
				engineLoad: 34
			})
	};
}

export const systemStore = createSystemStore();
