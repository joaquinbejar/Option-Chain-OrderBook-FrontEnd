import { writable } from 'svelte/store';
import { api } from '$lib/api/client';

export interface ControlsState {
	masterSwitch: boolean;
	spreadMultiplier: number;
	sizeScalar: number;
	directionalSkew: number;
	instruments: InstrumentStatus[];
}

export interface InstrumentStatus {
	symbol: string;
	displayName: string;
	exchanges: string[];
	isQuotingEnabled: boolean;
}

function createControlsStore() {
	const { subscribe, set, update } = writable<ControlsState>({
		masterSwitch: true,
		spreadMultiplier: 1.0,
		sizeScalar: 100,
		directionalSkew: 0,
		instruments: [
			{ symbol: 'BTC', displayName: 'BTC Options', exchanges: ['Deribit', 'CME'], isQuotingEnabled: true },
			{ symbol: 'ETH', displayName: 'ETH Options', exchanges: ['Deribit', 'CME'], isQuotingEnabled: true },
			{ symbol: 'SOL', displayName: 'SOL Options', exchanges: ['Deribit'], isQuotingEnabled: false },
			{ symbol: 'AVAX', displayName: 'AVAX Options', exchanges: ['Deribit'], isQuotingEnabled: true }
		]
	});

	return {
		subscribe,
		toggleMasterSwitch: async () => {
			update((s) => {
				const newState = !s.masterSwitch;
				if (!newState) {
					api.killSwitch().catch(console.error);
				}
				return { ...s, masterSwitch: newState };
			});
		},
		setSpreadMultiplier: (value: number) => {
			update((s) => ({ ...s, spreadMultiplier: value }));
			api.updateParameters({ spreadMultiplier: value }).catch(console.error);
		},
		setSizeScalar: (value: number) => {
			update((s) => ({ ...s, sizeScalar: value }));
			api.updateParameters({ sizeScalar: value }).catch(console.error);
		},
		setDirectionalSkew: (value: number) => {
			update((s) => ({ ...s, directionalSkew: value }));
			api.updateParameters({ directionalSkew: value }).catch(console.error);
		},
		toggleInstrument: async (symbol: string) => {
			update((s) => ({
				...s,
				instruments: s.instruments.map((i) =>
					i.symbol === symbol ? { ...i, isQuotingEnabled: !i.isQuotingEnabled } : i
				)
			}));
			api.toggleInstrument(symbol).catch(console.error);
		},
		reset: () =>
			set({
				masterSwitch: true,
				spreadMultiplier: 1.0,
				sizeScalar: 100,
				directionalSkew: 0,
				instruments: []
			})
	};
}

export const controlsStore = createControlsStore();
