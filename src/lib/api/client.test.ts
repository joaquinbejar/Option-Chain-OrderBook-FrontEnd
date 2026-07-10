import { describe, it, expect, vi, afterEach } from 'vitest';
import { api, ApiError } from './client';

// Pins the error-envelope contract: the backend answers non-2xx with
// `{ "error": "...", "code": "..." }` — that text is what operators see in
// the UI banners, so it must survive the ApiError mapping.
describe('fetchApi error mapping', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const respond = (status: number, body: unknown) =>
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(body === undefined ? '' : JSON.stringify(body), {
					status,
					headers: { 'Content-Type': 'application/json' }
				})
			)
		);

	it("surfaces the backend envelope's `error` text", async () => {
		respond(400, {
			error: 'invalid request: size_scalar must be finite and within [0, 1], got 1.5',
			code: 'INVALID_REQUEST'
		});

		await expect(api.getControls()).rejects.toMatchObject({
			name: 'ApiError',
			status: 400,
			message: 'invalid request: size_scalar must be finite and within [0, 1], got 1.5'
		});
	});

	it('falls back to a `message` field for non-envelope responses', async () => {
		respond(502, { message: 'upstream unavailable' });

		await expect(api.getControls()).rejects.toMatchObject({
			status: 502,
			message: 'upstream unavailable'
		});
	});

	it('falls back to the HTTP status when the body is not JSON', async () => {
		respond(500, undefined);

		const failure = api.getControls();
		await expect(failure).rejects.toBeInstanceOf(ApiError);
		await expect(failure).rejects.toMatchObject({ status: 500, message: 'HTTP 500' });
	});
});

// Pins the cancel-all wire shape: the backend applies present filters
// conjunctively and requires the lowercase side/style literals — a casing or
// naming drift here silently cancels nothing.
describe('cancelAllOrders query serialization', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// A fresh Response per call — a Response body is single-read.
	const respondCounts = () => {
		const fetchMock = vi.fn().mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify({ canceled_count: 0, failed_count: 0 }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			)
		);
		vi.stubGlobal('fetch', fetchMock);
		return fetchMock;
	};

	it('sends every present filter as a lowercase query param via DELETE', async () => {
		const fetchMock = respondCounts();

		await api.cancelAllOrders({
			underlying: 'BTC',
			expiration: '20260821',
			side: 'buy',
			style: 'call'
		});

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(
			'/api/v1/orders/cancel-all?underlying=BTC&expiration=20260821&side=buy&style=call'
		);
		expect(init.method).toBe('DELETE');
	});

	it('omits absent filters entirely — no empty params on the wire', async () => {
		const fetchMock = respondCounts();

		await api.cancelAllOrders({ side: 'sell' });
		await api.cancelAllOrders();

		expect((fetchMock.mock.calls[0] as [string])[0]).toBe('/api/v1/orders/cancel-all?side=sell');
		expect((fetchMock.mock.calls[1] as [string])[0]).toBe('/api/v1/orders/cancel-all');
	});
});
