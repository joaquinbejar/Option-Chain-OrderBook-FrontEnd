import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient, type WsMessage } from './websocket';
import { setAuthToken } from './auth-token';

/** Deterministic stand-in for the global WebSocket. */
class FakeWebSocket {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;
	static instances: FakeWebSocket[] = [];

	url: string;
	readyState = FakeWebSocket.CONNECTING;
	onopen: (() => void) | null = null;
	onmessage: ((event: { data: string }) => void) | null = null;
	onclose: ((event: { code: number; reason: string }) => void) | null = null;
	onerror: ((error: unknown) => void) | null = null;
	sent: string[] = [];

	constructor(url: string) {
		this.url = url;
		FakeWebSocket.instances.push(this);
	}

	send(data: string) {
		this.sent.push(data);
	}

	close() {
		this.readyState = FakeWebSocket.CLOSED;
	}

	/** Test helper — simulate a successful handshake. */
	open() {
		this.readyState = FakeWebSocket.OPEN;
		this.onopen?.();
	}

	/** Test helper — simulate the server dropping the connection. */
	drop() {
		this.readyState = FakeWebSocket.CLOSED;
		this.onclose?.({ code: 1006, reason: 'abnormal closure' });
	}
}

function lastSocket(): FakeWebSocket {
	const ws = FakeWebSocket.instances.at(-1);
	if (!ws) throw new Error('no FakeWebSocket instantiated');
	return ws;
}

beforeEach(() => {
	vi.useFakeTimers();
	FakeWebSocket.instances = [];
	vi.stubGlobal('WebSocket', FakeWebSocket);
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
	setAuthToken('test-jwt'); // connect() refuses to dial without a token
});

afterEach(() => {
	setAuthToken(null);
	vi.unstubAllGlobals();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('WebSocketClient — auth', () => {
	it('appends the JWT as a token query parameter', () => {
		const client = new WebSocketClient('ws://test/ws');
		client.connect();
		expect(lastSocket().url).toBe('ws://test/ws?token=test-jwt');
	});

	it('connect() is a no-op without a token', () => {
		setAuthToken(null);
		const client = new WebSocketClient('ws://test/ws');
		client.connect();
		expect(FakeWebSocket.instances).toHaveLength(0);
	});
});

describe('WebSocketClient — reconnect backoff', () => {
	it('schedules reconnects with exponential backoff (1s, 2s, 4s, …)', () => {
		const client = new WebSocketClient('ws://test/ws');
		client.connect();
		expect(FakeWebSocket.instances).toHaveLength(1);

		for (let attempt = 0; attempt < 3; attempt++) {
			lastSocket().drop();
			expect(vi.getTimerCount()).toBe(1);

			const delay = 1000 * 2 ** attempt;
			vi.advanceTimersByTime(delay - 1);
			expect(FakeWebSocket.instances).toHaveLength(attempt + 1); // not yet

			vi.advanceTimersByTime(1);
			expect(FakeWebSocket.instances).toHaveLength(attempt + 2); // reconnected
		}
	});

	it('stops reconnecting after the max attempt cap', () => {
		const client = new WebSocketClient('ws://test/ws');
		client.connect();

		for (let attempt = 0; attempt < 10; attempt++) {
			lastSocket().drop();
			vi.runOnlyPendingTimers();
		}
		expect(FakeWebSocket.instances).toHaveLength(11);

		lastSocket().drop();
		expect(vi.getTimerCount()).toBe(0); // cap reached, nothing scheduled
	});

	it('a successful open resets the backoff to the base delay', () => {
		const client = new WebSocketClient('ws://test/ws');
		client.connect();

		lastSocket().drop(); // schedules 1000ms
		vi.runOnlyPendingTimers();
		lastSocket().drop(); // schedules 2000ms
		vi.runOnlyPendingTimers();

		lastSocket().open(); // attempts reset
		lastSocket().drop();

		vi.advanceTimersByTime(999);
		expect(FakeWebSocket.instances).toHaveLength(3);
		vi.advanceTimersByTime(1);
		expect(FakeWebSocket.instances).toHaveLength(4); // back to 1s, not 4s
	});

	it('disconnect() during the backoff gap cancels the pending reconnect', () => {
		const client = new WebSocketClient('ws://test/ws');
		client.connect();
		lastSocket().drop(); // schedules a reconnect in 1s; ws is now null

		client.disconnect(); // deliberate close while the timer is pending

		vi.runAllTimers();
		expect(FakeWebSocket.instances).toHaveLength(1); // never resurrected
	});

	it('disconnect() prevents any auto-reconnect', () => {
		const client = new WebSocketClient('ws://test/ws');
		client.connect();
		const ws = lastSocket();
		ws.open();

		client.disconnect();
		expect(client.isConnected).toBe(false);
		expect(ws.readyState).toBe(FakeWebSocket.CLOSED);

		ws.onclose?.({ code: 1000, reason: 'client closed' });
		expect(vi.getTimerCount()).toBe(0);
	});

	it('connect() is a no-op while already connected', () => {
		const client = new WebSocketClient('ws://test/ws');
		client.connect();
		lastSocket().open();

		client.connect();
		expect(FakeWebSocket.instances).toHaveLength(1);
	});
});

describe('WebSocketClient — messaging', () => {
	it('dispatches parsed frames to subscribers, and unsubscribe stops delivery', () => {
		const client = new WebSocketClient('ws://test/ws');
		client.connect();
		lastSocket().open();

		const received: WsMessage[] = [];
		const unsubscribe = client.subscribe((msg) => received.push(msg));

		const frame: WsMessage = { type: 'price', data: { symbol: 'BTC', price_cents: 100 } };
		lastSocket().onmessage?.({ data: JSON.stringify(frame) });
		expect(received).toEqual([frame]);

		unsubscribe();
		lastSocket().onmessage?.({ data: JSON.stringify(frame) });
		expect(received).toHaveLength(1);
	});

	it('drops a malformed frame without throwing into the handler loop', () => {
		const client = new WebSocketClient('ws://test/ws');
		client.connect();
		lastSocket().open();

		const handler = vi.fn();
		client.subscribe(handler);

		expect(() => lastSocket().onmessage?.({ data: 'not-json{' })).not.toThrow();
		expect(handler).not.toHaveBeenCalled();
		expect(console.error).toHaveBeenCalled();
	});

	it('send() only writes when the socket is open', () => {
		const client = new WebSocketClient('ws://test/ws');
		client.connect();
		const ws = lastSocket();

		client.send('subscribe', 'BTC');
		expect(ws.sent).toHaveLength(0); // still CONNECTING

		ws.open();
		client.send('subscribe', 'BTC', 1);
		expect(ws.sent).toEqual([JSON.stringify({ action: 'subscribe', symbol: 'BTC', value: 1 })]);
	});
});
