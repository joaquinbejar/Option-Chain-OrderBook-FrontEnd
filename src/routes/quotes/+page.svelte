<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api/client';

	let underlyings = $state<string[]>([]);
	let selectedUnderlying = $state('SPY');
	let loading = $state(true);

	onMount(async () => {
		try {
			const result = await api.listUnderlyings();
			underlyings = result.underlyings;
			if (underlyings.length > 0) {
				selectedUnderlying = underlyings[0];
			}
		} catch (e) {
			console.error('Failed to load underlyings:', e);
		} finally {
			loading = false;
		}
	});

	const mockQuotes = [
		{ strike: 26000, callBid: 26120, callAsk: 26140, callBidSize: 15, callAskSize: 42, putBid: 450.5, putAsk: 465.0, putBidSize: 10, putAskSize: 8.2, spread: 2.0, skew: 5 },
		{ strike: 26250, callBid: 26220, callAsk: 26250, callBidSize: 12, callAskSize: 30, putBid: 380.0, putAsk: 395.0, putBidSize: 8, putAskSize: 15, spread: 2.5, skew: 0 },
		{ strike: 26500, callBid: 26480, callAsk: 26520, callBidSize: 50, callAskSize: 100, putBid: 320.5, putAsk: 340.0, putBidSize: 22, putAskSize: 25, spread: 4.0, skew: -10 },
		{ strike: 26750, callBid: 26700, callAsk: 26750, callBidSize: 5, callAskSize: 12, putBid: 250.0, putAsk: 275.0, putBidSize: 18, putAskSize: 15, spread: 2.0, skew: 0 },
		{ strike: 27000, callBid: 26900, callAsk: 26980, callBidSize: 2, callAskSize: 8, putBid: 180.0, putAsk: 205.0, putBidSize: 45, putAskSize: 30, spread: 3.5, skew: 2 }
	];
</script>

<div class="p-6 flex flex-col gap-6 max-w-[1600px] mx-auto">
	<!-- Stats Row -->
	<section class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
		<div class="bg-surface-dark border border-border-dark rounded-lg p-4 flex flex-col justify-between h-28 relative overflow-hidden group">
			<p class="text-text-muted text-sm font-medium">Delta Exposure</p>
			<div>
				<p class="text-white text-2xl font-bold tracking-tight">+150.5</p>
				<p class="text-success text-sm font-medium flex items-center gap-1 mt-1">
					<span class="material-symbols-outlined text-sm">trending_up</span> +2.5%
				</p>
			</div>
		</div>
		<div class="bg-surface-dark border border-border-dark rounded-lg p-4 flex flex-col justify-between h-28">
			<p class="text-text-muted text-sm font-medium">Gamma</p>
			<div>
				<p class="text-white text-2xl font-bold tracking-tight">-42.1</p>
				<p class="text-text-muted text-sm font-medium mt-1">Stable</p>
			</div>
		</div>
		<div class="bg-surface-dark border border-border-dark rounded-lg p-4 flex flex-col justify-between h-28">
			<p class="text-text-muted text-sm font-medium">Theta (Decay)</p>
			<div>
				<p class="text-white text-2xl font-bold tracking-tight">-210.0</p>
				<p class="text-success text-sm font-medium flex items-center gap-1 mt-1">+1.2%</p>
			</div>
		</div>
		<div class="bg-surface-dark border border-border-dark rounded-lg p-4 flex flex-col justify-between h-28">
			<p class="text-text-muted text-sm font-medium">Vega</p>
			<div>
				<p class="text-white text-2xl font-bold tracking-tight">+85.4</p>
				<p class="text-danger text-sm font-medium flex items-center gap-1 mt-1">
					<span class="material-symbols-outlined text-sm">trending_down</span> -0.5%
				</p>
			</div>
		</div>
		<div class="bg-surface-dark border border-primary/30 rounded-lg p-4 flex flex-col justify-between h-28 relative overflow-hidden">
			<div class="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none"></div>
			<p class="text-text-muted text-sm font-medium">Daily P&L</p>
			<div>
				<p class="text-white text-2xl font-bold tracking-tight">+$12,450</p>
				<p class="text-success text-sm font-medium flex items-center gap-1 mt-1">+5.4% Target</p>
			</div>
		</div>
	</section>

	<!-- Quote Matrix -->
	<div class="flex flex-col bg-surface-dark border border-border-dark rounded-lg overflow-hidden shadow-sm">
		<div class="p-4 border-b border-border-dark flex items-center justify-between bg-[#151b26]">
			<h3 class="text-white font-bold flex items-center gap-2">
				<span class="material-symbols-outlined text-primary">view_column</span>
				Quote Matrix - {selectedUnderlying}
			</h3>
			<div class="flex gap-2">
				<button class="p-1.5 rounded hover:bg-[#232f48] text-text-muted hover:text-white transition-colors">
					<span class="material-symbols-outlined text-[20px]">filter_list</span>
				</button>
				<button class="p-1.5 rounded hover:bg-[#232f48] text-text-muted hover:text-white transition-colors">
					<span class="material-symbols-outlined text-[20px]">download</span>
				</button>
			</div>
		</div>

		<!-- Table Header -->
		<div class="grid grid-cols-12 gap-0 text-xs font-semibold text-text-muted border-b border-border-dark bg-[#1a2230] py-2">
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
			<div class="col-span-3 text-center px-4">Parameters</div>
		</div>

		<!-- Table Body -->
		<div class="overflow-y-auto flex-1 max-h-[600px]">
			<div class="sticky top-0 z-10 bg-[#232f48] py-1 px-4 text-xs font-bold text-white shadow-md border-y border-border-dark flex justify-between">
				<span>EXP: 29 SEP 23 (2 Days)</span>
				<span class="text-text-muted font-normal">IV: 42.5%</span>
			</div>

			{#each mockQuotes as quote, i}
				<div class="group grid grid-cols-12 gap-0 py-2 border-b border-border-dark/50 items-center hover:bg-[#232f48]/50 transition-colors text-xs font-mono {i === 2 ? 'bg-[#135bec]/10 border-l-2 border-l-primary' : ''}">
					<!-- Calls -->
					<div class="col-span-4 grid grid-cols-4 text-center items-center text-white">
						<div class="text-text-muted">{quote.callBidSize}</div>
						<div class="text-success font-bold">{quote.callBid.toLocaleString()}</div>
						<div class="text-danger font-bold">{quote.callAsk.toLocaleString()}</div>
						<div class="text-text-muted">{quote.callAskSize}</div>
					</div>
					<!-- Strike -->
					<div class="col-span-1 flex items-center justify-center border-x border-border-dark bg-[#151b26] h-full py-1">
						<span class="font-bold text-white bg-[#232f48] px-2 py-0.5 rounded {i === 2 ? 'text-primary bg-primary/20 border border-primary/50' : ''}">{quote.strike}</span>
					</div>
					<!-- Puts -->
					<div class="col-span-4 grid grid-cols-4 text-center items-center text-white">
						<div class="text-text-muted">{quote.putBidSize}</div>
						<div class="text-success font-bold">{quote.putBid}</div>
						<div class="text-danger font-bold">{quote.putAsk}</div>
						<div class="text-text-muted">{quote.putAskSize}</div>
					</div>
					<!-- Controls -->
					<div class="col-span-3 px-2 flex items-center gap-2 h-full">
						<div class="flex-1 flex flex-col gap-1">
							<div class="flex items-center justify-between text-[10px] text-text-muted mb-0.5">
								<span>Sprd</span>
								<span class="{i === 2 ? 'text-primary font-bold' : ''}">{quote.spread}</span>
							</div>
							<div class="h-1 w-full bg-[#232f48] rounded-full overflow-hidden">
								<div class="h-full bg-primary" style="width: {quote.spread * 15}%"></div>
							</div>
						</div>
						<div class="flex-1 flex flex-col gap-1">
							<div class="flex items-center justify-between text-[10px] text-text-muted mb-0.5">
								<span>Skew</span>
								<span class="{quote.skew > 0 ? 'text-success' : quote.skew < 0 ? 'text-danger' : ''}">{quote.skew > 0 ? '+' : ''}{quote.skew}</span>
							</div>
							<div class="h-1 w-full bg-[#232f48] rounded-full overflow-hidden relative">
								<div class="absolute left-1/2 w-[2px] h-full bg-white/30"></div>
								{#if quote.skew !== 0}
									<div class="h-full {quote.skew > 0 ? 'bg-success ml-[50%]' : 'bg-danger'}" style="width: {Math.abs(quote.skew) * 3}%; {quote.skew < 0 ? `margin-left: ${50 - Math.abs(quote.skew) * 3}%` : ''}"></div>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
