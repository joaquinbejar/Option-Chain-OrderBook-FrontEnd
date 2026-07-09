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
	/** Last command failure, user-visible; null when everything is confirmed. */
	error: string | null;
}

export interface InstrumentStatus {
	symbol: string;
	displayName: string;
	exchanges: string[];
	isQuotingEnabled: boolean;
	currentPrice: number | null;
}

function createControlsStore() {
	// Guards the halt/resume round-trip: a second click while the first
	// request is in flight must not fire a second (possibly opposite) command.
	let switchPending = false;

	const { subscribe, set, update } = writable<ControlsState>({
		masterSwitch: true,
		spreadMultiplier: 1.0,
		sizeScalar: 100,
		directionalSkew: 0,
		instruments: [],
		loading: true,
		error: null
	});

	type ParamField = 'spreadMultiplier' | 'sizeScalar' | 'directionalSkew';

	// Per-field request generation: a slider drag fires one request per input
	// tick, and responses may resolve out of order. Only the latest request
	// for a field may write back — stale echoes/failures are ignored, so the
	// thumb never snaps backward under the pointer.
	const paramGeneration: Record<ParamField, number> = {
		spreadMultiplier: 0,
		sizeScalar: 0,
		directionalSkew: 0
	};

	/**
	 * Optimistically apply one quoting parameter, then reconcile that field
	 * only: on success adopt the backend's echoed value (its clamping wins);
	 * on failure revert the field to its snapshot and surface a visible
	 * error. Concurrent updates to the other fields are never touched.
	 */
	const applyParameter = async (
		field: ParamField,
		value: number,
		request: { spreadMultiplier?: number; sizeScalar?: number; directionalSkew?: number },
		label: string
	) => {
		const generation = ++paramGeneration[field];
		let previous = value;
		update((s) => {
			previous = s[field];
			return { ...s, [field]: value, error: null };
		});

		try {
			const result = await api.updateParameters(request);
			if (generation !== paramGeneration[field]) return; // superseded by a newer tick
			const echo: Record<ParamField, number> = {
				spreadMultiplier: result.spread_multiplier,
				// The POST response echoes size_scalar as a percent (×100).
				sizeScalar: result.size_scalar,
				directionalSkew: result.directional_skew
			};
			update((s) => ({ ...s, [field]: echo[field] }));
		} catch (e) {
			if (generation !== paramGeneration[field]) return; // superseded by a newer tick
			console.error(`Failed to update ${label}:`, e);
			// The snapshot may itself be an optimistic value from an earlier
			// in-flight tick; the periodic WS config broadcast reconciles any
			// residual drift to backend truth.
			update((s) => ({
				...s,
				[field]: previous,
				error: `Failed to update the ${label} — the change was not applied.`
			}));
		}
	};

	// Subscribe to WebSocket config updates
	if (typeof window !== 'undefined') {
		const ws = getWebSocketClient();
		ws.subscribe((msg: WsMessage) => {
			if (msg.type === 'config') {
				update((s) => ({
					...s,
					masterSwitch: msg.data.enabled,
					spreadMultiplier: msg.data.spread_multiplier,
					// Backend reads expose size_scalar as a fraction [0, 1]; the UI
					// (and the write API) speak percent [0, 100].
					sizeScalar: msg.data.size_scalar * 100,
					directionalSkew: msg.data.directional_skew
				}));
			} else if (msg.type === 'price') {
				update((s) => ({
					...s,
					instruments: s.instruments.map((i) =>
						i.symbol === msg.data.symbol ? { ...i, currentPrice: msg.data.price_cents / 100 } : i
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
					// Fraction [0, 1] on read → percent [0, 100] in the store/UI.
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
				update((s) => ({
					...s,
					loading: false,
					error: 'Failed to load controls from the backend.'
				}));
			}
		},
		/**
		 * Fire the kill switch — always halts, regardless of the state the UI
		 * believed at click time. The destructive intent is captured explicitly
		 * so a concurrent config update cannot invert it into an enable.
		 */
		halt: async () => {
			if (switchPending) return;
			switchPending = true;
			// A new command clears the previous banner; success leaves the error
			// field alone so an unrelated flow's failure is never masked.
			update((s) => ({ ...s, error: null }));
			try {
				const result = await api.killSwitch();
				update((s) => ({ ...s, masterSwitch: result.master_enabled }));
			} catch (e) {
				console.error('Failed to fire the kill switch:', e);
				update((s) => ({
					...s,
					error: 'Kill switch command failed — quoting state is unchanged.'
				}));
			} finally {
				switchPending = false;
			}
		},

		/** Re-enable quoting — always enables, never halts. */
		resume: async () => {
			if (switchPending) return;
			switchPending = true;
			update((s) => ({ ...s, error: null }));
			try {
				const result = await api.enableQuoting();
				update((s) => ({ ...s, masterSwitch: result.master_enabled }));
			} catch (e) {
				console.error('Failed to re-enable quoting:', e);
				update((s) => ({
					...s,
					error: 'Enable-quoting command failed — quoting state is unchanged.'
				}));
			} finally {
				switchPending = false;
			}
		},
		setSpreadMultiplier: (value: number) =>
			applyParameter('spreadMultiplier', value, { spreadMultiplier: value }, 'spread multiplier'),
		// The write API expects percent [0, 100] — no conversion here.
		setSizeScalar: (value: number) =>
			applyParameter('sizeScalar', value, { sizeScalar: value }, 'size scalar'),
		setDirectionalSkew: (value: number) =>
			applyParameter('directionalSkew', value, { directionalSkew: value }, 'directional skew'),
		toggleInstrument: async (symbol: string) => {
			update((s) => ({ ...s, error: null }));
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
				update((s) => ({
					...s,
					error: `Failed to toggle quoting for ${symbol} — its state is unchanged.`
				}));
			}
		},
		clearError: () => update((s) => ({ ...s, error: null })),
		reset: () =>
			set({
				masterSwitch: true,
				spreadMultiplier: 1.0,
				sizeScalar: 100,
				directionalSkew: 0,
				instruments: [],
				loading: true,
				error: null
			})
	};
}

export const controlsStore = createControlsStore();
