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
