/**
 * WebSocket client for real-time updates from the backend.
 */

export type WsMessageType = 'quote' | 'fill' | 'config' | 'price' | 'connected' | 'heartbeat';

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

export type WsMessage =
	| WsQuoteMessage
	| WsFillMessage
	| WsConfigMessage
	| WsPriceMessage
	| WsConnectedMessage
	| WsHeartbeatMessage;

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

		this.isConnecting = true;

		try {
			this.ws = new WebSocket(this.url);

			this.ws.onopen = () => {
				console.log('WebSocket connected');
				this.isConnecting = false;
				this.reconnectAttempts = 0;
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
	 * Disconnect from the WebSocket server.
	 */
	disconnect(): void {
		this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
		if (this.ws) {
			this.ws.close();
			this.ws = null;
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

		setTimeout(() => {
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
