/**
 * WebSocket client for real-time updates from the backend.
 *
 * Auth: browsers cannot set headers on the upgrade, so the JWT travels as a
 * `?token=<jwt>` query parameter, read fresh from the data-layer token holder
 * on every (re)connect. Without a token, connect() is a no-op — the backend
 * would reject the upgrade with 401 anyway.
 */
import { getAuthToken } from '$lib/api/auth-token';

export type WsMessageType =
	| 'quote'
	| 'fill'
	| 'config'
	| 'price'
	| 'connected'
	| 'heartbeat'
	| 'orderbook_snapshot'
	| 'orderbook_delta'
	| 'trade'
	| 'subscribed'
	| 'unsubscribed'
	| 'error';

/** All price fields on WS frames are INTEGER CENTS (see `client.ts` contract). */
export interface WsQuoteMessage {
	type: 'quote';
	data: {
		symbol: string;
		expiration: string;
		/**
		 * Strike in cents — the same u64 the REST strikes endpoints return, so
		 * WS and REST strike values key against each other without conversion.
		 */
		strike: number;
		style: string;
		/** Bid price in cents. */
		bid_price: number;
		/** Ask price in cents. */
		ask_price: number;
		bid_size: number;
		ask_size: number;
	};
}

export interface WsFillMessage {
	type: 'fill';
	data: {
		order_id: string;
		symbol: string;
		instrument: string;
		side: string;
		quantity: number;
		/** Fill price in cents. */
		price: number;
		/** Edge captured in cents. */
		edge: number;
	};
}

export interface WsConfigMessage {
	type: 'config';
	data: {
		enabled: boolean;
		spread_multiplier: number;
		/** FRACTION in [0, 1] — same scale as GET /controls, not a percent. */
		size_scalar: number;
		directional_skew: number;
	};
}

export interface WsPriceMessage {
	type: 'price';
	data: {
		symbol: string;
		/** Underlying price in cents. */
		price_cents: number;
	};
}

export interface WsConnectedMessage {
	type: 'connected';
	data: {
		message: string;
	};
}

export interface WsHeartbeatMessage {
	type: 'heartbeat';
	data: {
		timestamp: number;
	};
}

/** One resting level on the WS book wire. Price is INTEGER CENTS. */
export interface WsBookLevel {
	price: number;
	quantity: number;
}

/**
 * Full book state for one instrument, sent by the backend in response to an
 * orderbook subscribe (including a re-subscribe — that is the resync path).
 * `sequence` is a per-symbol counter shared with the deltas that follow, so a
 * client can order a snapshot against its delta stream.
 */
export interface WsOrderbookSnapshotMessage {
	type: 'orderbook_snapshot';
	data: {
		channel: string;
		symbol: string;
		sequence: number;
		/** Best-first (descending prices). */
		bids: WsBookLevel[];
		/** Best-first (ascending prices). */
		asks: WsBookLevel[];
	};
}

/**
 * Incremental book update after a user-driven mutation. Each change carries
 * the RESULTING total quantity at that level — `0` means the level is gone.
 * Delivery is best-effort: on a sequence gap, re-subscribe for a fresh
 * snapshot. Market-maker requote churn is intentionally not published here.
 */
export interface WsOrderbookDeltaMessage {
	type: 'orderbook_delta';
	data: {
		symbol: string;
		sequence: number;
		changes: Array<{
			side: 'bid' | 'ask';
			/** Level price in cents. */
			price: number;
			/** Resulting quantity at the level; 0 removes it. */
			quantity: number;
		}>;
	};
}

/** One executed fill on the trades channel. */
export interface WsTradeMessage {
	type: 'trade';
	data: {
		trade_id: string;
		symbol: string;
		/** Execution price in cents. */
		price: number;
		quantity: number;
		timestamp_ms: number;
		maker_order_id: string;
		taker_order_id: string;
	};
}

export interface WsSubscribedMessage {
	type: 'subscribed';
	data: {
		channel: string;
		symbol: string;
	};
}

export interface WsUnsubscribedMessage {
	type: 'unsubscribed';
	data: {
		channel: string;
		symbol: string;
	};
}

export interface WsErrorMessage {
	type: 'error';
	data: {
		message: string;
	};
}

export type WsMessage =
	| WsQuoteMessage
	| WsFillMessage
	| WsConfigMessage
	| WsPriceMessage
	| WsConnectedMessage
	| WsHeartbeatMessage
	| WsOrderbookSnapshotMessage
	| WsOrderbookDeltaMessage
	| WsTradeMessage
	| WsSubscribedMessage
	| WsUnsubscribedMessage
	| WsErrorMessage;

export type WsMessageHandler = (message: WsMessage) => void;

/**
 * WebSocket connection manager.
 */
export class WebSocketClient {
	private ws: WebSocket | null = null;
	private url: string;
	private handlers: Set<WsMessageHandler> = new Set();
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 10;
	private reconnectDelay = 1000;
	private isConnecting = false;
	private deliberateClose = false;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	// Desired channel subscriptions, keyed by symbol. Replayed on every
	// (re)open: the backend answers an orderbook subscribe with a fresh
	// snapshot, so the replay doubles as the post-reconnect resync.
	private bookSubscriptions = new Map<string, number>();
	private tradeSubscriptions = new Set<string>();

	constructor(url: string = 'ws://localhost:8080/ws') {
		this.url = url;
	}

	/**
	 * Connect to the WebSocket server.
	 */
	connect(): void {
		if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
			return;
		}

		const token = getAuthToken();
		if (!token) {
			// No credentials yet — the auth store reconnects consumers on login.
			return;
		}

		// An explicit connect() (page mount, re-login) re-arms auto-reconnect
		// after a deliberate close and supersedes any pending backoff timer.
		this.deliberateClose = false;
		this.clearReconnectTimer();
		this.isConnecting = true;

		try {
			this.ws = new WebSocket(`${this.url}?token=${encodeURIComponent(token)}`);

			this.ws.onopen = () => {
				console.log('WebSocket connected');
				this.isConnecting = false;
				this.reconnectAttempts = 0;
				// Replay the desired subscriptions — a new socket knows nothing.
				// Each orderbook replay yields a fresh snapshot, which is exactly
				// the resync a reconnected book consumer needs.
				for (const [symbol, depth] of this.bookSubscriptions) {
					this.sendRaw({ action: 'subscribe', channel: 'orderbook', symbol, depth });
				}
				for (const symbol of this.tradeSubscriptions) {
					this.sendRaw({ action: 'subscribe', channel: 'trades', symbol });
				}
			};

			this.ws.onmessage = (event) => {
				try {
					const message: WsMessage = JSON.parse(event.data);
					this.handlers.forEach((handler) => handler(message));
				} catch (e) {
					console.error('Failed to parse WebSocket message:', e);
				}
			};

			this.ws.onclose = (event) => {
				console.log('WebSocket closed:', event.code, event.reason);
				this.isConnecting = false;
				this.ws = null;
				if (this.deliberateClose) {
					this.deliberateClose = false;
					return;
				}
				this.scheduleReconnect();
			};

			this.ws.onerror = (error) => {
				console.error('WebSocket error:', error);
				this.isConnecting = false;
			};
		} catch (e) {
			console.error('Failed to create WebSocket:', e);
			this.isConnecting = false;
			this.scheduleReconnect();
		}
	}

	/**
	 * Disconnect from the WebSocket server. A deliberate close never
	 * auto-reconnects; a later explicit connect() re-arms reconnection.
	 */
	disconnect(): void {
		this.deliberateClose = true;
		// A handshake may be in flight — clear the flag so a later explicit
		// connect() (e.g. fast re-login) is not silently swallowed.
		this.isConnecting = false;
		// A reconnect may be sitting in its backoff gap — a deliberate close
		// must cancel it, or the socket resurrects itself.
		this.clearReconnectTimer();
		this.reconnectAttempts = 0;
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer !== null) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	/**
	 * Subscribe to WebSocket messages.
	 */
	subscribe(handler: WsMessageHandler): () => void {
		this.handlers.add(handler);
		return () => this.handlers.delete(handler);
	}

	/**
	 * Send a command to the server.
	 */
	send(action: string, symbol?: string, value?: number): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ action, symbol, value }));
		}
	}

	private sendRaw(payload: Record<string, unknown>): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(payload));
		}
	}

	/**
	 * Subscribe to per-level book updates for one instrument
	 * (`UNDERLYING-EXPIRATION-STRIKE-C|P`). The backend answers with an
	 * `orderbook_snapshot`, then streams `orderbook_delta` frames. Tracked
	 * across reconnects.
	 */
	subscribeOrderbook(symbol: string, depth = 10): void {
		this.bookSubscriptions.set(symbol, depth);
		this.sendRaw({ action: 'subscribe', channel: 'orderbook', symbol, depth });
	}

	unsubscribeOrderbook(symbol: string): void {
		this.bookSubscriptions.delete(symbol);
		this.sendRaw({ action: 'unsubscribe', channel: 'orderbook', symbol });
	}

	/** Subscribe to executed trades for one instrument. Tracked across reconnects. */
	subscribeTrades(symbol: string): void {
		this.tradeSubscriptions.add(symbol);
		this.sendRaw({ action: 'subscribe', channel: 'trades', symbol });
	}

	unsubscribeTrades(symbol: string): void {
		this.tradeSubscriptions.delete(symbol);
		this.sendRaw({ action: 'unsubscribe', channel: 'trades', symbol });
	}

	/**
	 * Re-request an orderbook stream already subscribed to — the backend
	 * re-sends a fresh snapshot. This is the recovery path when a consumer
	 * detects a sequence gap in the delta stream.
	 */
	resyncOrderbook(symbol: string): void {
		const depth = this.bookSubscriptions.get(symbol);
		if (depth !== undefined) {
			this.sendRaw({ action: 'subscribe', channel: 'orderbook', symbol, depth });
		}
	}

	/**
	 * Check if connected.
	 */
	get isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	private scheduleReconnect(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.log('Max reconnection attempts reached');
			return;
		}

		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
		this.reconnectAttempts++;

		console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.connect();
		}, delay);
	}
}

// Singleton instance
let wsClient: WebSocketClient | null = null;

/**
 * Get or create the WebSocket client instance.
 */
export function getWebSocketClient(): WebSocketClient {
	if (!wsClient) {
		// Use relative URL in browser, absolute in SSR
		const wsUrl =
			typeof window !== 'undefined'
				? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
				: 'ws://localhost:8080/ws';
		wsClient = new WebSocketClient(wsUrl);
	}
	return wsClient;
}
