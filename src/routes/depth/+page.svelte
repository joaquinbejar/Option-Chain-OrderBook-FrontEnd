<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api/client';
	import { depthStore, type OptionBookDepth } from '$lib/stores/depth';

	let underlyings = $state<string[]>([]);
	let expirations = $state<string[]>([]);
	let strikes = $state<number[]>([]);

	let selectedUnderlying = $state('');
	let selectedExpiration = $state('');
	let selectedStrike = $state(0);

	/** Underlying mark price in dollars; null until the backend provides one. */
	let markPrice = $state<number | null>(null);
	let listError = $state<string | null>(null);

	// Strikes travel as integer cents (same unit as every option price).
	const strikeDollars = $derived(selectedStrike / 100);
	// Compare on integer cents so ATM is actually reachable (no float equality).
	const markCents = $derived(markPrice !== null ? Math.round(markPrice * 100) : null);
	const callMoneyness = $derived.by(() => {
		if (markCents === null || selectedStrike === 0) return null;
		if (markCents === selectedStrike) return 'ATM';
		return markCents > selectedStrike ? 'ITM' : 'OTM';
	});
	const putMoneyness = $derived.by(() => {
		if (markCents === null || selectedStrike === 0) return null;
		if (markCents === selectedStrike) return 'ATM';
		return markCents < selectedStrike ? 'ITM' : 'OTM';
	});

	onMount(() => {
		loadUnderlyings();
		return () => depthStore.reset();
	});

	async function loadUnderlyings() {
		listError = null;
		try {
			const resp = await api.listUnderlyings();
			underlyings = resp.underlyings;
			if (underlyings.length > 0) {
				selectedUnderlying = underlyings[0];
				await onUnderlyingChange();
			}
		} catch (e) {
			console.error('Failed to load underlyings:', e);
			listError = 'Failed to load instruments from the backend.';
		}
	}

	async function onUnderlyingChange() {
		listError = null;
		expirations = [];
		strikes = [];
		selectedExpiration = '';
		selectedStrike = 0;
		markPrice = null;
		depthStore.reset();
		if (!selectedUnderlying) return;

		loadMarkPrice();
		try {
			const resp = await api.listExpirations(selectedUnderlying);
			expirations = resp.expirations;
			if (expirations.length > 0) {
				selectedExpiration = expirations[0];
				await onExpirationChange();
			}
		} catch (e) {
			console.error('Failed to load expirations:', e);
			listError = 'Failed to load expirations from the backend.';
		}
	}

	async function onExpirationChange() {
		listError = null;
		strikes = [];
		selectedStrike = 0;
		depthStore.reset();
		if (!selectedUnderlying || !selectedExpiration) return;

		try {
			const resp = await api.listStrikes(selectedUnderlying, selectedExpiration);
			strikes = resp.strikes;
			if (strikes.length > 0) {
				selectedStrike = strikes[Math.floor(strikes.length / 2)]; // middle strike
				onStrikeChange();
			}
		} catch (e) {
			console.error('Failed to load strikes:', e);
			listError = 'Failed to load strikes from the backend.';
		}
	}

	function onStrikeChange() {
		if (!selectedUnderlying || !selectedExpiration || !selectedStrike) return;
		depthStore.loadBooks(selectedUnderlying, selectedExpiration, selectedStrike);
	}

	async function loadMarkPrice() {
		// A slow response for a previously selected underlying must not land.
		const forUnderlying = selectedUnderlying;
		try {
			const resp = await api.getLatestPrice(forUnderlying);
			if (selectedUnderlying === forUnderlying) {
				markPrice = resp.price; // /prices speaks dollars
			}
		} catch {
			// No price recorded for this underlying — render the placeholder.
			if (selectedUnderlying === forUnderlying) {
				markPrice = null;
			}
		}
	}

	function formatTime(ms: number): string {
		return new Date(ms).toLocaleTimeString('en-US', { hour12: false });
	}

	function getDepthWidth(size: number, maxSize: number): string {
		if (maxSize <= 0) return '0%';
		return `${Math.min((size / maxSize) * 100, 100)}%`;
	}

	function formatMoney(value: number): string {
		return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
</script>

{#snippet bookLadder(book: OptionBookDepth)}
	<!-- Cumulative totals are monotonic, so the last level holds each side's max. -->
	{@const maxAskTotal = book.asks.length > 0 ? book.asks[book.asks.length - 1].total : 0}
	{@const maxBidTotal = book.bids.length > 0 ? book.bids[book.bids.length - 1].total : 0}
	<!-- Column header -->
	<div
		class="grid grid-cols-3 px-4 py-2 bg-background-dark text-text-muted text-xs font-semibold uppercase tracking-wider border-b border-border-dark"
	>
		<div class="text-left">Total</div>
		<div class="text-center">Price (USD)</div>
		<div class="text-right">Size</div>
	</div>

	<!-- Asks (rendered descending toward the spread) -->
	<div class="bg-background-dark">
		{#each [...book.asks].reverse() as ask (ask.price)}
			<div class="relative grid grid-cols-3 px-4 h-8 items-center text-sm font-medium">
				<div
					class="absolute inset-y-0 right-0 bg-danger/10"
					style="width: {getDepthWidth(ask.total, maxAskTotal)}"
				></div>
				<div class="z-10 text-white/50 tabular-nums">{ask.total.toLocaleString()}</div>
				<div class="z-10 text-danger text-center tabular-nums">{formatMoney(ask.price)}</div>
				<div class="z-10 text-white text-right tabular-nums">{ask.size.toLocaleString()}</div>
			</div>
		{:else}
			<div class="px-4 py-3 text-center text-text-muted text-xs">No resting asks</div>
		{/each}
	</div>

	<!-- Spread -->
	<div
		class="py-2 bg-surface-dark border-y border-border-dark flex justify-center items-center gap-4"
	>
		<span class="text-text-muted text-xs font-medium uppercase tracking-widest">Spread</span>
		<span class="text-white text-sm font-bold tabular-nums"
			>{book.spread !== null ? book.spread.toFixed(2) : '—'}</span
		>
		<span class="text-text-muted text-xs"
			>({book.spreadPercent !== null ? `${book.spreadPercent.toFixed(2)}%` : '—'})</span
		>
	</div>

	<!-- Bids -->
	<div class="bg-background-dark">
		{#each book.bids as bid (bid.price)}
			<div class="relative grid grid-cols-3 px-4 h-8 items-center text-sm font-medium">
				<div
					class="absolute inset-y-0 right-0 bg-success/10"
					style="width: {getDepthWidth(bid.total, maxBidTotal)}"
				></div>
				<div class="z-10 text-white/50 tabular-nums">{bid.total.toLocaleString()}</div>
				<div class="z-10 text-success text-center tabular-nums">{formatMoney(bid.price)}</div>
				<div class="z-10 text-white text-right tabular-nums">{bid.size.toLocaleString()}</div>
			</div>
		{:else}
			<div class="px-4 py-3 text-center text-text-muted text-xs">No resting bids</div>
		{/each}
	</div>
{/snippet}

{#snippet bookState()}
	<div class="p-8 text-center text-text-muted">
		{#if $depthStore.loading}
			Loading order book…
		{:else if $depthStore.error}
			<span role="alert" class="text-danger">{$depthStore.error}</span>
		{:else if selectedStrike !== 0}
			No order book available for this option
		{:else}
			Select an option to view its order book
		{/if}
	</div>
{/snippet}

{#snippet greeksRow()}
	<!-- The backend does not expose per-option Greeks yet — placeholders, not inventions. -->
	<div class="grid grid-cols-4 gap-px bg-border-dark border-b border-border-dark">
		{#each ['Delta', 'Gamma', 'Vega', 'Theta'] as greek (greek)}
			<div class="bg-surface-dark p-3 text-center">
				<div class="text-text-muted text-[10px] uppercase tracking-wider mb-1">{greek}</div>
				<div class="text-text-muted text-sm font-medium tabular-nums">
					—<span class="sr-only">{greek} is not provided by the backend yet</span>
				</div>
			</div>
		{/each}
	</div>
{/snippet}

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-white">Option Pair Depth Monitor</h1>
			<p class="text-text-muted text-sm mt-1">
				Point-in-time order book snapshots for Call/Put pairs
			</p>
		</div>
		<button
			onclick={onStrikeChange}
			disabled={$depthStore.loading || !selectedStrike}
			class="flex items-center gap-2 bg-surface-dark hover:bg-border-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold border border-border-dark rounded-lg px-4 py-2 transition-colors"
		>
			<span
				class="material-symbols-outlined text-base {$depthStore.loading ? 'animate-spin' : ''}"
				aria-hidden="true">refresh</span
			>
			{$depthStore.loading ? 'Refreshing…' : 'Refresh'}
		</button>
	</div>

	{#if listError}
		<div
			role="alert"
			class="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-sm font-medium text-danger"
		>
			<span class="material-symbols-outlined text-base" aria-hidden="true">error</span>
			{listError}
		</div>
	{/if}

	<!-- Controls Ribbon -->
	<div class="bg-surface-dark rounded-xl border border-border-dark p-4">
		<div class="flex flex-wrap items-end gap-4">
			<!-- Underlying -->
			<div class="flex flex-col gap-1.5 min-w-[140px]">
				<label
					for="depth-underlying"
					class="text-text-muted text-xs font-semibold uppercase tracking-wider">Underlying</label
				>
				<select
					id="depth-underlying"
					bind:value={selectedUnderlying}
					onchange={onUnderlyingChange}
					class="bg-background-dark border border-border-dark text-white text-sm rounded-lg p-2.5 font-bold focus:ring-primary focus:border-primary"
				>
					{#each underlyings as underlying (underlying)}
						<option value={underlying}>{underlying}</option>
					{/each}
				</select>
			</div>

			<!-- Expiration -->
			<div class="flex flex-col gap-1.5 min-w-[140px]">
				<label
					for="depth-expiration"
					class="text-text-muted text-xs font-semibold uppercase tracking-wider">Expiration</label
				>
				<select
					id="depth-expiration"
					bind:value={selectedExpiration}
					onchange={onExpirationChange}
					class="bg-background-dark border border-border-dark text-white text-sm rounded-lg p-2.5 font-bold focus:ring-primary focus:border-primary"
				>
					{#each expirations as exp (exp)}
						<option value={exp}>{exp}</option>
					{/each}
				</select>
			</div>

			<!-- Strike -->
			<div class="flex flex-col gap-1.5 min-w-[140px]">
				<label
					for="depth-strike"
					class="text-text-muted text-xs font-semibold uppercase tracking-wider">Strike</label
				>
				<select
					id="depth-strike"
					bind:value={selectedStrike}
					onchange={onStrikeChange}
					class="bg-primary/20 border border-primary text-white text-sm rounded-lg p-2.5 font-bold focus:ring-primary focus:border-primary shadow-[0_0_15px_rgba(19,91,236,0.15)]"
				>
					{#each strikes as strike (strike)}
						<option value={strike}>{formatMoney(strike / 100)}</option>
					{/each}
				</select>
			</div>

			<!-- Stats Summary -->
			<div class="flex-1 flex justify-end">
				<div
					class="flex gap-4 items-center p-3 rounded-lg bg-border-dark/50 border border-border-dark/30"
				>
					<div class="flex flex-col px-3 border-r border-border-dark">
						<span class="text-text-muted text-xs">Underlying</span>
						<span class="text-white text-lg font-bold tabular-nums"
							>{markPrice !== null ? `$${formatMoney(markPrice)}` : '—'}</span
						>
					</div>
					<div class="flex flex-col px-3">
						<span class="text-text-muted text-xs">IV Index</span>
						<span class="text-text-muted text-lg font-bold tabular-nums"
							>—<span class="sr-only">Not provided by the backend yet</span></span
						>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Order Books Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- CALL Order Book -->
		<div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
			<div
				class="px-5 py-4 border-b border-border-dark bg-gradient-to-r from-primary/10 to-transparent flex justify-between items-center"
			>
				<div>
					<h3 class="text-primary text-xl font-bold">
						CALL {selectedStrike !== 0 ? formatMoney(strikeDollars) : '—'}
					</h3>
					<p class="text-text-muted text-xs mt-0.5">
						{selectedExpiration ? `Expires ${selectedExpiration}` : '—'}
						{#if $depthStore.call}
							· snapshot {formatTime($depthStore.call.timestampMs)}
						{/if}
					</p>
				</div>
				{#if callMoneyness !== null}
					<span
						class="px-2 py-1 rounded text-xs font-bold border {callMoneyness === 'OTM'
							? 'bg-red-900/30 text-red-400 border-red-900/50'
							: 'bg-green-900/30 text-green-400 border-green-900/50'}">{callMoneyness}</span
					>
				{/if}
			</div>

			{@render greeksRow()}

			{#if $depthStore.call}
				{@render bookLadder($depthStore.call)}
			{:else}
				{@render bookState()}
			{/if}
		</div>

		<!-- PUT Order Book -->
		<div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
			<div
				class="px-5 py-4 border-b border-border-dark bg-gradient-to-r from-purple-600/10 to-transparent flex justify-between items-center"
			>
				<div>
					<h3 class="text-purple-400 text-xl font-bold">
						PUT {selectedStrike !== 0 ? formatMoney(strikeDollars) : '—'}
					</h3>
					<p class="text-text-muted text-xs mt-0.5">
						{selectedExpiration ? `Expires ${selectedExpiration}` : '—'}
						{#if $depthStore.put}
							· snapshot {formatTime($depthStore.put.timestampMs)}
						{/if}
					</p>
				</div>
				{#if putMoneyness !== null}
					<span
						class="px-2 py-1 rounded text-xs font-bold border {putMoneyness === 'OTM'
							? 'bg-red-900/30 text-red-400 border-red-900/50'
							: 'bg-green-900/30 text-green-400 border-green-900/50'}">{putMoneyness}</span
					>
				{/if}
			</div>

			{@render greeksRow()}

			{#if $depthStore.put}
				{@render bookLadder($depthStore.put)}
			{:else}
				{@render bookState()}
			{/if}
		</div>
	</div>
</div>
