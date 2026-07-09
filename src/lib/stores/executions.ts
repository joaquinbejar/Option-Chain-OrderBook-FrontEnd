/**
 * Execution monitor store — accumulates WS `fill` frames while the
 * /executions view is open (the page resets it on mount, so counters read
 * "since this view opened" truthfully). Fill prices and edge arrive as
 * INTEGER CENTS and convert to dollars here, exactly once. The backend does
 * not (yet) provide a fills history endpoint.
 */

import { derived, writable } from 'svelte/store';
import { getWebSocketClient, type WsMessage } from '$lib/api/websocket';

export interface ExecutionFill {
	/**
	 * Session-unique row identity. order_id is NOT unique per fill (one
	 * resting order can fill several times) and receipt time can collide
	 * within a millisecond, so rows carry their own sequence.
	 */
	seq: number;
	orderId: string;
	symbol: string;
	instrument: string;
	/** Normalized to uppercase BUY / SELL. */
	side: string;
	quantity: number;
	/** Fill price in dollars. */
	price: number;
	/** Edge captured in dollars. */
	edge: number;
	/** Local receipt time (ms since epoch) — the frame carries no timestamp. */
	receivedAt: number;
}

export interface ExecutionsState {
	/** Newest first, capped at MAX_FILLS. */
	fills: ExecutionFill[];
	/** Every fill seen since the view opened, including ones dropped by the cap. */
	totalReceived: number;
}

/** Keep the table bounded — old rows fall off, the counter keeps the truth. */
export const MAX_FILLS = 200;

function createInitialState(): ExecutionsState {
	return { fills: [], totalReceived: 0 };
}

function createExecutionsStore() {
	const { subscribe, set, update } = writable<ExecutionsState>(createInitialState());

	let wsUnsubscribe: (() => void) | null = null;
	let nextSeq = 0;

	const handleWsMessage = (msg: WsMessage) => {
		if (msg.type !== 'fill') return;
		const { order_id, symbol, instrument, side, quantity, price, edge } = msg.data;
		const fill: ExecutionFill = {
			seq: nextSeq++,
			orderId: order_id,
			symbol,
			instrument,
			side: side.toUpperCase(),
			quantity,
			price: price / 100, // cents → dollars, the single conversion site
			edge: edge / 100,
			receivedAt: Date.now()
		};
		update((s) => ({
			fills: [fill, ...s.fills].slice(0, MAX_FILLS),
			totalReceived: s.totalReceived + 1
		}));
	};

	return {
		subscribe,

		/** Connect and subscribe. Re-init replaces the handler, never stacks it. */
		init() {
			if (typeof window === 'undefined') return;
			const ws = getWebSocketClient();
			ws.connect();
			if (wsUnsubscribe) {
				wsUnsubscribe();
			}
			wsUnsubscribe = ws.subscribe(handleWsMessage);
		},

		/** Drop this store's WS subscription (the shared socket stays open). */
		disconnect() {
			if (wsUnsubscribe) {
				wsUnsubscribe();
				wsUnsubscribe = null;
			}
		},

		reset() {
			set(createInitialState());
		}
	};
}

export const executionsStore = createExecutionsStore();

/** Average edge captured per fill (dollars); null with no fills — render as `—`. */
export const avgEdge = derived(executionsStore, ($s) =>
	$s.fills.length > 0 ? $s.fills.reduce((sum, f) => sum + f.edge, 0) / $s.fills.length : null
);
