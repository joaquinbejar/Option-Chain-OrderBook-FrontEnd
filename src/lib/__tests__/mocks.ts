import { vi } from 'vitest';
import type { WsMessage, WsMessageHandler } from '$lib/api/websocket';

/**
 * A controllable fake of the WebSocket client singleton.
 * `emit` pushes a frame to every subscriber, simulating the backend.
 */
export function makeFakeWsClient() {
	const handlers = new Set<WsMessageHandler>();
	let connected = true;
	return {
		connect: vi.fn(),
		disconnect: vi.fn(),
		send: vi.fn(),
		get isConnected() {
			return connected;
		},
		/** test helper — simulate the socket dropping or coming back */
		setConnected(value: boolean) {
			connected = value;
		},
		subscribe: vi.fn((h: WsMessageHandler) => {
			handlers.add(h);
			return () => handlers.delete(h);
		}),
		emit(msg: WsMessage) {
			handlers.forEach((h) => h(msg));
		}
	};
}

export type FakeWsClient = ReturnType<typeof makeFakeWsClient>;
