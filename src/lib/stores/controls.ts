import { writable } from 'svelte/store';
import { api } from '$lib/api/client';
import { getWebSocketClient, type WsMessage } from '$lib/api/websocket';

export interface ControlsState {
	masterSwitch: boolean;
	spreadMultiplier: number;
	sizeScalar: number;
	directionalSkew: number;
	instruments: InstrumentStatus[];
	loading: boolean;
}

export interface InstrumentStatus {
	symbol: string;
	displayName: string;
	exchanges: string[];
	isQuotingEnabled: boolean;
	currentPrice: number | null;
}

function createControlsStore() {
	const { subscribe, set, update } = writable<ControlsState>({
		masterSwitch: true,
		spreadMultiplier: 1.0,
		sizeScalar: 100,
		directionalSkew: 0,
		instruments: [],
		loading: true
	});

	// Subscribe to WebSocket config updates
	if (typeof window !== 'undefined') {
		const ws = getWebSocketClient();
		ws.subscribe((msg: WsMessage) => {
			if (msg.type === 'config') {
				update((s) => ({
					...s,
					masterSwitch: msg.data.enabled,
					spreadMultiplier: msg.data.spread_multiplier,
					sizeScalar: msg.data.size_scalar * 100,
					directionalSkew: msg.data.directional_skew
				}));
			} else if (msg.type === 'price') {
				update((s) => ({
					...s,
					instruments: s.instruments.map((i) =>
						i.symbol === msg.data.symbol
							? { ...i, currentPrice: msg.data.price_cents / 100 }
							: i
					)
				}));
			}
		});
	}

	return {
		subscribe,
		init: async () => {
			try {
				const [controls, instrumentsResp] = await Promise.all([
					api.getControls(),
					api.listInstruments()
				]);

				update((s) => ({
					...s,
					masterSwitch: controls.master_enabled,
					spreadMultiplier: controls.spread_multiplier,
					sizeScalar: controls.size_scalar * 100,
					directionalSkew: controls.directional_skew,
					instruments: instrumentsResp.instruments.map((i) => ({
						symbol: i.symbol,
						displayName: `${i.symbol} Options`,
						exchanges: ['Exchange'],
						isQuotingEnabled: i.quoting_enabled,
						currentPrice: i.current_price
					})),
					loading: false
				}));

				// Connect WebSocket after initial load
				if (typeof window !== 'undefined') {
					getWebSocketClient().connect();
				}
			} catch (e) {
				console.error('Failed to initialize controls:', e);
				update((s) => ({ ...s, loading: false }));
			}
		},
		toggleMasterSwitch: async () => {
			let currentState = false;
			update((s) => {
				currentState = s.masterSwitch;
				return s;
			});

			try {
				if (currentState) {
					const result = await api.killSwitch();
					update((s) => ({ ...s, masterSwitch: result.master_enabled }));
				} else {
					const result = await api.enableQuoting();
					update((s) => ({ ...s, masterSwitch: result.master_enabled }));
				}
			} catch (e) {
				console.error('Failed to toggle master switch:', e);
			}
		},
		setSpreadMultiplier: async (value: number) => {
			update((s) => ({ ...s, spreadMultiplier: value }));
			try {
				await api.updateParameters({ spreadMultiplier: value });
			} catch (e) {
				console.error('Failed to update spread multiplier:', e);
			}
		},
		setSizeScalar: async (value: number) => {
			update((s) => ({ ...s, sizeScalar: value }));
			try {
				await api.updateParameters({ sizeScalar: value });
			} catch (e) {
				console.error('Failed to update size scalar:', e);
			}
		},
		setDirectionalSkew: async (value: number) => {
			update((s) => ({ ...s, directionalSkew: value }));
			try {
				await api.updateParameters({ directionalSkew: value });
			} catch (e) {
				console.error('Failed to update directional skew:', e);
			}
		},
		toggleInstrument: async (symbol: string) => {
			try {
				const result = await api.toggleInstrument(symbol);
				update((s) => ({
					...s,
					instruments: s.instruments.map((i) =>
						i.symbol === result.symbol ? { ...i, isQuotingEnabled: result.enabled } : i
					)
				}));
			} catch (e) {
				console.error('Failed to toggle instrument:', e);
			}
		},
		reset: () =>
			set({
				masterSwitch: true,
				spreadMultiplier: 1.0,
				sizeScalar: 100,
				directionalSkew: 0,
				instruments: [],
				loading: true
			})
	};
}

export const controlsStore = createControlsStore();
