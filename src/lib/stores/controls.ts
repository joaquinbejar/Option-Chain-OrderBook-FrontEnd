import { writable } from 'svelte/store';
import { api, ApiError } from '$lib/api/client';
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
	/** Non-error command outcome worth showing (e.g. cancel-all counts). */
	notice: string | null;
	/** True while a cancel-all command is in flight. */
	cancelingAll: boolean;
}

export interface InstrumentStatus {
	symbol: string;
	isQuotingEnabled: boolean;
	currentPrice: number | null;
}

/**
 * Optional scoping for cancel-all. Omitted fields match everything; the
 * backend applies each present filter conjunctively (side/style lowercase).
 */
export interface CancelAllFilters {
	underlying?: string;
	expiration?: string;
	side?: 'buy' | 'sell';
	style?: 'call' | 'put';
}

/**
 * Human-readable scope suffix (`' matching …'`, or `''` when unscoped).
 * Shared by the confirm dialog and the outcome banners so the text the
 * operator authorizes and the text reporting the result cannot drift.
 */
export const describeCancelScope = (filters?: CancelAllFilters): string => {
	const parts = [
		filters?.side,
		filters?.style ? `${filters.style}s` : undefined,
		filters?.underlying ? `on ${filters.underlying}` : undefined,
		filters?.expiration ? `expiring ${filters.expiration}` : undefined,
		// An expiration with no underlying spans every product — say so, or
		// the scope reads narrower than what the backend will cancel.
		filters?.expiration && !filters?.underlying ? 'across all underlyings' : undefined
	].filter((p): p is string => Boolean(p));
	return parts.length > 0 ? ` matching ${parts.join(' ')}` : '';
};

function createControlsStore() {
	// Guards the halt/resume round-trip: a second click while the first
	// request is in flight must not fire a second (possibly opposite) command.
	let switchPending = false;
	// Same guard for cancel-all — one confirmed click, one command.
	let cancelAllPending = false;

	// A 403 is a permission denial, not a transient failure — say so, or the
	// operator retries a command their token can never execute.
	const isForbidden = (e: unknown): boolean => e instanceof ApiError && e.status === 403;

	const { subscribe, set, update } = writable<ControlsState>({
		masterSwitch: true,
		spreadMultiplier: 1.0,
		sizeScalar: 100,
		directionalSkew: 0,
		instruments: [],
		loading: true,
		error: null,
		notice: null,
		cancelingAll: false
	});

	type ParamField = 'spreadMultiplier' | 'sizeScalar' | 'directionalSkew';

	// size_scalar is a FRACTION in [0, 1] on every wire path (backend #82);
	// the store/UI speak percent [0, 100]. Convert here, at the store's wire
	// boundary, and nowhere else. The ×100 is rounded to 2-decimal percents so
	// float noise (0.8 × 100 = 80.00000000000001) never reaches the UI and a
	// value read from the backend writes back as the same fraction.
	const toPercent = (fraction: number): number => Math.round(fraction * 10_000) / 100;
	const toFraction = (percent: number): number => percent / 100;

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
		request: { spread_multiplier?: number; size_scalar?: number; directional_skew?: number },
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
				// The POST response echoes size_scalar as a fraction, like GET.
				sizeScalar: toPercent(result.size_scalar),
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
				error: isForbidden(e)
					? `Permission denied — changing the ${label} requires an admin token.`
					: // A 400 carries the backend's validation message (the
						// allowed range) — show it, not a generic failure line.
						e instanceof ApiError && e.status === 400
						? `The ${label} was rejected: ${e.message}`
						: `Failed to update the ${label} — the change was not applied.`
			}));
		}
	};

	let wsUnsubscribe: (() => void) | null = null;

	// init() re-runs on every re-login (the layout $effect); a stale REST
	// response from a previous session must not overwrite the fresh one.
	let initGeneration = 0;

	const handleWsMessage = (msg: WsMessage) => {
		if (msg.type === 'config') {
			update((s) => ({
				...s,
				masterSwitch: msg.data.enabled,
				spreadMultiplier: msg.data.spread_multiplier,
				// Fraction [0, 1] on the wire → percent [0, 100] in the store/UI.
				sizeScalar: toPercent(msg.data.size_scalar),
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
	};

	return {
		subscribe,
		init: async () => {
			const generation = ++initGeneration;
			// Connect and subscribe before the REST load so config frames during
			// the fetch are not missed; re-init drops the previous handler first,
			// so a double init can never leak a subscription.
			if (typeof window !== 'undefined') {
				const ws = getWebSocketClient();
				ws.connect();
				if (wsUnsubscribe) {
					wsUnsubscribe();
				}
				wsUnsubscribe = ws.subscribe(handleWsMessage);
			}
			try {
				const [controls, instrumentsResp] = await Promise.all([
					api.getControls(),
					api.listInstruments()
				]);
				if (generation !== initGeneration) return; // superseded by a newer session

				update((s) => ({
					...s,
					masterSwitch: controls.master_enabled,
					spreadMultiplier: controls.spread_multiplier,
					// Fraction [0, 1] on the wire → percent [0, 100] in the store/UI.
					sizeScalar: toPercent(controls.size_scalar),
					directionalSkew: controls.directional_skew,
					// Only what the backend actually sends — no invented metadata.
					instruments: instrumentsResp.instruments.map((i) => ({
						symbol: i.symbol,
						isQuotingEnabled: i.quoting_enabled,
						currentPrice: i.current_price
					})),
					loading: false
				}));
			} catch (e) {
				if (generation !== initGeneration) return; // superseded by a newer session
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
					error: isForbidden(e)
						? 'Permission denied — the kill switch requires an admin token.'
						: 'Kill switch command failed — quoting state is unchanged.'
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
					error: isForbidden(e)
						? 'Permission denied — enabling quoting requires an admin token.'
						: 'Enable-quoting command failed — quoting state is unchanged.'
				}));
			} finally {
				switchPending = false;
			}
		},
		setSpreadMultiplier: (value: number) =>
			applyParameter('spreadMultiplier', value, { spread_multiplier: value }, 'spread multiplier'),
		// `value` is a percent (the UI slider); the wire takes the fraction.
		setSizeScalar: (value: number) =>
			applyParameter('sizeScalar', value, { size_scalar: toFraction(value) }, 'size scalar'),
		setDirectionalSkew: (value: number) =>
			applyParameter('directionalSkew', value, { directional_skew: value }, 'directional skew'),
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
					error: isForbidden(e)
						? `Permission denied — toggling ${symbol} requires an admin token.`
						: `Failed to toggle quoting for ${symbol} — its state is unchanged.`
				}));
			}
		},
		/**
		 * Cancel every open order matching the optional filters (none = all).
		 * Destructive — the UI confirms before calling. Requires the `trade`
		 * permission on the backend.
		 */
		cancelAllOrders: async (filters?: CancelAllFilters) => {
			if (cancelAllPending) return;
			cancelAllPending = true;
			const scope = describeCancelScope(filters);
			update((s) => ({ ...s, error: null, notice: null, cancelingAll: true }));
			try {
				const result = await api.cancelAllOrders(filters);
				// Any failed cancel means live orders remain — that is an alert,
				// never a green checkmark.
				if (result.failed_count > 0) {
					update((s) => ({
						...s,
						cancelingAll: false,
						error: `Canceled ${result.canceled_count} orders${scope}, but ${result.failed_count} FAILED to cancel and are still live.`
					}));
				} else if (result.canceled_count === 0) {
					// Zero matches on a scoped cancel usually means the scope was
					// wrong (stale expiration, wrong side) — that must not read
					// like a green "done".
					update((s) => ({
						...s,
						cancelingAll: false,
						notice: scope
							? `No open orders${scope} — nothing was canceled.`
							: 'No open orders to cancel.'
					}));
				} else {
					update((s) => ({
						...s,
						cancelingAll: false,
						notice: `Canceled ${result.canceled_count} open orders${scope}.`
					}));
				}
			} catch (e) {
				console.error('Failed to cancel all orders:', e);
				update((s) => ({
					...s,
					cancelingAll: false,
					error: isForbidden(e)
						? 'Permission denied — canceling orders requires a trade token.'
						: // A 400 carries the backend's validation message (e.g. an
							// invalid side/style filter) — show it.
							e instanceof ApiError && e.status === 400
							? `Cancel-all was rejected: ${e.message}`
							: 'Cancel-all command failed — open orders are unchanged.'
				}));
			} finally {
				cancelAllPending = false;
			}
		},
		clearError: () => update((s) => ({ ...s, error: null })),
		clearNotice: () => update((s) => ({ ...s, notice: null })),
		/** Drop this store's WS subscription (the shared socket stays open). */
		disconnect: () => {
			initGeneration++; // an in-flight init must not land after teardown
			if (wsUnsubscribe) {
				wsUnsubscribe();
				wsUnsubscribe = null;
			}
			// Stale banners must not survive into the next session/visit.
			update((s) => ({ ...s, error: null, notice: null }));
		},
		reset: () =>
			set({
				masterSwitch: true,
				spreadMultiplier: 1.0,
				sizeScalar: 100,
				directionalSkew: 0,
				instruments: [],
				loading: true,
				error: null,
				notice: null,
				cancelingAll: false
			})
	};
}

export const controlsStore = createControlsStore();
