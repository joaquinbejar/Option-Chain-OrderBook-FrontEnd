<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import type { Permission } from '$lib/api/client';

	let mode = $state<'token' | 'mint'>('token');
	let tokenInput = $state('');
	let secretInput = $state('');
	let wantTrade = $state(true);
	let wantAdmin = $state(false);
	let submitting = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		submitting = true;
		try {
			if (mode === 'token') {
				if (authStore.useToken(tokenInput)) {
					tokenInput = '';
				}
			} else {
				const permissions: Permission[] = ['read'];
				if (wantTrade) permissions.push('trade');
				if (wantAdmin) permissions.push('admin');
				await authStore.login(secretInput, permissions);
			}
		} finally {
			submitting = false;
			// Never keep credentials in component state longer than needed.
			secretInput = '';
		}
	}
</script>

<div class="flex-1 flex items-center justify-center p-6 bg-[#0f1218]">
	<div class="w-full max-w-md bg-surface-dark border border-border-dark rounded-xl p-8 shadow-2xl">
		<div class="flex items-center gap-3 mb-2">
			<span class="material-symbols-outlined text-primary" aria-hidden="true">lock</span>
			<h1 class="text-white text-xl font-bold">Authentication required</h1>
		</div>
		<p class="text-text-muted text-sm mb-6">
			The backend requires a JWT on every request. Paste a token minted by the operator, or mint one
			here with the bootstrap secret.
		</p>

		{#if $authStore.error}
			<div
				role="alert"
				class="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 mb-4 text-sm text-danger"
			>
				<span class="material-symbols-outlined text-base" aria-hidden="true">error</span>
				{$authStore.error}
			</div>
		{/if}

		<!-- Plain toggle buttons — an honest widget beats an incomplete ARIA tab pattern -->
		<div class="flex gap-2 mb-5">
			<button
				type="button"
				aria-pressed={mode === 'token'}
				onclick={() => (mode = 'token')}
				class="flex-1 h-9 rounded-lg text-sm font-bold transition-colors {mode === 'token'
					? 'bg-primary/20 border border-primary/30 text-primary'
					: 'bg-background-dark border border-border-dark text-text-muted hover:text-white'}"
			>
				Paste token
			</button>
			<button
				type="button"
				aria-pressed={mode === 'mint'}
				onclick={() => (mode = 'mint')}
				class="flex-1 h-9 rounded-lg text-sm font-bold transition-colors {mode === 'mint'
					? 'bg-primary/20 border border-primary/30 text-primary'
					: 'bg-background-dark border border-border-dark text-text-muted hover:text-white'}"
			>
				Mint token
			</button>
		</div>

		<form onsubmit={submit} class="flex flex-col gap-4">
			{#if mode === 'token'}
				<div class="flex flex-col gap-1.5">
					<label for="auth-token" class="text-text-muted text-xs font-semibold uppercase">
						JWT
					</label>
					<textarea
						id="auth-token"
						bind:value={tokenInput}
						rows="4"
						required
						autocomplete="off"
						spellcheck="false"
						placeholder="eyJhbGciOi…"
						class="bg-background-dark border border-border-dark text-white text-xs font-mono rounded-lg p-2.5 focus:ring-primary focus:border-primary resize-none"
					></textarea>
				</div>
			{:else}
				<div class="flex flex-col gap-1.5">
					<label for="auth-secret" class="text-text-muted text-xs font-semibold uppercase">
						Bootstrap secret
					</label>
					<input
						id="auth-secret"
						type="password"
						bind:value={secretInput}
						required
						autocomplete="off"
						class="bg-background-dark border border-border-dark text-white text-sm rounded-lg p-2.5 focus:ring-primary focus:border-primary"
					/>
				</div>
				<fieldset class="flex gap-4">
					<legend class="text-text-muted text-xs font-semibold uppercase mb-1.5">
						Permissions (read is always included)
					</legend>
					<label class="flex items-center gap-2 text-sm text-white">
						<input type="checkbox" bind:checked={wantTrade} class="accent-primary" />
						trade
					</label>
					<label class="flex items-center gap-2 text-sm text-white">
						<input type="checkbox" bind:checked={wantAdmin} class="accent-primary" />
						admin
					</label>
				</fieldset>
			{/if}

			<button
				type="submit"
				disabled={submitting}
				class="h-10 rounded-lg bg-primary hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-bold transition-colors"
			>
				{submitting ? 'Authenticating…' : 'Authenticate'}
			</button>
		</form>
	</div>
</div>
