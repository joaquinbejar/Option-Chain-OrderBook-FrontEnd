<script lang="ts">
	import { onMount } from 'svelte';
	import { marketStore, buildQuoteMatrix, type QuoteData } from '$lib/stores/market';

	let selectedUnderlying = $state('');
	let selectedExpiration = $state('');
	let strikes = $state<number[]>([]);

	const underlyings = $derived($marketStore.underlyings);
	const expirations = $derived(
		selectedUnderlying ? ($marketStore.expirations.get(selectedUnderlying) ?? []) : []
	);
	// Live rows: quote frames mutate the store map and re-derive the matrix.
	const rows = $derived(
		buildQuoteMatrix($marketStore.quotes, selectedUnderlying, selectedExpiration, strikes)
	);

	onMount(() => {
		marketStore.init(); // loads underlyings + expirations, connects the WS
		return () => marketStore.disconnect();
	});

	// Pick the first underlying once the initial load lands.
	$effect(() => {
		if (!selectedUnderlying && $marketStore.underlyings.length > 0) {
			selectedUnderlying = $marketStore.underlyings[0];
			handleUnderlyingChange();
		}
	});

	// Expirations for the selected underlying load after the underlyings list
	// (init fetches them per underlying) — auto-pick the first one when they
	// arrive, or the matrix would sit empty until a manual re-selection.
	$effect(() => {
		if (selectedUnderlying && !selectedExpiration && expirations.length > 0) {
			selectedExpiration = expirations[0];
			handleExpirationChange();
		}
	});

	async function handleUnderlyingChange() {
		strikes = [];
		// The auto-pick effect covers expirations that have not loaded yet.
		selectedExpiration = expirations.length > 0 ? expirations[0] : '';
		await handleExpirationChange();
	}

	async function handleExpirationChange() {
		strikes = [];
		if (!selectedUnderlying || !selectedExpiration) return;
		strikes = await marketStore.loadStrikes(selectedUnderlying, selectedExpiration);
	}

	function formatMoney(value: number): string {
		return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	// A zero-size side is an empty book side — render `—`, never a $0.00 quote.
	function sidePrice(quote: QuoteData | null, side: 'bid' | 'ask'): string {
		if (!quote) return '—';
		const size = side === 'bid' ? quote.bidSize : quote.askSize;
		if (size === 0) return '—';
		return formatMoney(side === 'bid' ? quote.bidPrice : quote.askPrice);
	}

	function sideSize(quote: QuoteData | null, side: 'bid' | 'ask'): string {
		if (!quote) return '—';
		const size = side === 'bid' ? quote.bidSize : quote.askSize;
		return size === 0 ? '—' : size.toLocaleString();
	}
</script>

<div class="p-6 flex flex-col gap-6 max-w-[1600px] mx-auto">
	<!-- Stats Row — the backend exposes none of these yet -->
	<section class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
		{#each ['Delta Exposure', 'Gamma', 'Theta (Decay)', 'Vega', 'Daily P&L'] as metric (metric)}
			<div
				class="bg-surface-dark border border-border-dark rounded-lg p-4 flex flex-col justify-between h-28"
			>
				<p class="text-text-muted text-sm font-medium">{metric}</p>
				<div>
					<p class="text-text-muted text-2xl font-bold tracking-tight">—</p>
					<p class="text-text-muted text-xs font-medium mt-1">Not provided by the backend</p>
				</div>
			</div>
		{/each}
	</section>

	<!-- Quote Matrix -->
	<div
		class="flex flex-col bg-surface-dark border border-border-dark rounded-lg overflow-hidden shadow-sm"
	>
		<div class="p-4 border-b border-border-dark flex items-center justify-between bg-[#151b26]">
			<h3 class="text-white font-bold flex items-center gap-2">
				<span class="material-symbols-outlined text-primary">view_column</span>
				Quote Matrix - {selectedUnderlying || 'Select Underlying'}
			</h3>
			<div class="flex gap-4 items-center">
				<select
					bind:value={selectedUnderlying}
					onchange={handleUnderlyingChange}
					class="bg-background-dark border border-border-dark text-white text-sm rounded-lg p-2 font-medium focus:ring-primary focus:border-primary"
				>
					{#each underlyings as underlying (underlying)}
						<option value={underlying}>{underlying}</option>
					{/each}
				</select>
				<select
					bind:value={selectedExpiration}
					onchange={handleExpirationChange}
					class="bg-background-dark border border-border-dark text-white text-sm rounded-lg p-2 font-medium focus:ring-primary focus:border-primary"
				>
					{#each expirations as exp (exp)}
						<option value={exp}>{exp}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Table Header -->
		<div
			class="grid grid-cols-9 gap-0 text-xs font-semibold text-text-muted border-b border-border-dark bg-[#1a2230] py-2"
		>
			<div class="col-span-4 grid grid-cols-4 text-center">
				<div>Bid Size</div>
				<div>Bid</div>
				<div>Ask</div>
				<div>Ask Size</div>
			</div>
			<div class="col-span-1 text-center border-x border-border-dark text-white">Strike</div>
			<div class="col-span-4 grid grid-cols-4 text-center">
				<div>Bid Size</div>
				<div>Bid</div>
				<div>Ask</div>
				<div>Ask Size</div>
			</div>
		</div>

		{#if rows.length > 0}
			<!-- Matrix rows: live WS quotes aligned by strike; empty sides render — -->
			<div class="divide-y divide-border-dark/50">
				{#each rows as row (row.strike)}
					<div class="grid grid-cols-9 gap-0 text-sm py-2 hover:bg-white/5 transition-colors">
						<div class="col-span-4 grid grid-cols-4 text-center tabular-nums">
							<div class="text-text-muted">{sideSize(row.call, 'bid')}</div>
							<div class="text-success font-medium">{sidePrice(row.call, 'bid')}</div>
							<div class="text-danger font-medium">{sidePrice(row.call, 'ask')}</div>
							<div class="text-text-muted">{sideSize(row.call, 'ask')}</div>
						</div>
						<div
							class="col-span-1 text-center border-x border-border-dark text-white font-bold tabular-nums"
						>
							{formatMoney(row.strike / 100)}
						</div>
						<div class="col-span-4 grid grid-cols-4 text-center tabular-nums">
							<div class="text-text-muted">{sideSize(row.put, 'bid')}</div>
							<div class="text-success font-medium">{sidePrice(row.put, 'bid')}</div>
							<div class="text-danger font-medium">{sidePrice(row.put, 'ask')}</div>
							<div class="text-text-muted">{sideSize(row.put, 'ask')}</div>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<!-- Empty State -->
			<div class="flex flex-col items-center justify-center py-16 px-4">
				<span class="material-symbols-outlined text-6xl text-text-muted/30 mb-4">format_quote</span>
				<h4 class="text-white text-lg font-bold mb-2">No Strikes Available</h4>
				<p class="text-text-muted text-sm text-center max-w-md">
					No strikes exist for the selected underlying and expiration. Quotes stream in live over
					the WebSocket once the market maker is quoting.
				</p>
				<a
					href="/controls"
					class="mt-6 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
				>
					Go to Controls
				</a>
			</div>
		{/if}
	</div>
</div>
