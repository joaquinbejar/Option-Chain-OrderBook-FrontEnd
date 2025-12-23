<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api/client';

	let underlyings: string[] = [];
	let expirations: string[] = [];
	let strikes: number[] = [];

	let selectedUnderlying = '';
	let selectedExpiration = '';
	let selectedStrike = 0;

	let callBook: OrderBookData | null = null;
	let putBook: OrderBookData | null = null;
	let loading = false;

	interface OrderLevel {
		price: number;
		size: number;
		total: number;
	}

	interface OrderBookData {
		symbol: string;
		bids: OrderLevel[];
		asks: OrderLevel[];
		spread: number;
		spreadPercent: number;
		quote: {
			bid_price: number | null;
			ask_price: number | null;
			bid_size: number;
			ask_size: number;
		};
	}

	// Mock Greeks data (would come from pricing engine)
	const callGreeks = { delta: 0.54, gamma: 0.02, vega: 12.5, theta: -15.2 };
	const putGreeks = { delta: -0.46, gamma: 0.02, vega: 12.1, theta: -14.8 };

	onMount(async () => {
		try {
			const resp = await api.listUnderlyings();
			underlyings = resp.underlyings;
			if (underlyings.length > 0) {
				selectedUnderlying = underlyings[0];
				await loadExpirations();
			}
		} catch (e) {
			console.error('Failed to load underlyings:', e);
			// Use mock data for demo
			underlyings = ['BTC', 'ETH', 'SOL'];
			selectedUnderlying = 'BTC';
		}
	});

	async function loadExpirations() {
		if (!selectedUnderlying) return;
		try {
			const resp = await api.listExpirations(selectedUnderlying);
			expirations = resp.expirations;
			if (expirations.length > 0) {
				selectedExpiration = expirations[0];
				await loadStrikes();
			}
		} catch (e) {
			console.error('Failed to load expirations:', e);
			expirations = ['20240329', '20240405', '20240412'];
			selectedExpiration = '20240329';
		}
	}

	async function loadStrikes() {
		if (!selectedUnderlying || !selectedExpiration) return;
		try {
			const resp = await api.listStrikes(selectedUnderlying, selectedExpiration);
			strikes = resp.strikes;
			if (strikes.length > 0) {
				selectedStrike = strikes[Math.floor(strikes.length / 2)]; // Select middle strike
				await loadOrderBooks();
			}
		} catch (e) {
			console.error('Failed to load strikes:', e);
			strikes = [26000, 26500, 27000, 27500, 28000];
			selectedStrike = 27000;
		}
	}

	async function loadOrderBooks() {
		if (!selectedUnderlying || !selectedExpiration || !selectedStrike) return;
		loading = true;

		try {
			const [callResp, putResp] = await Promise.all([
				api.getOptionBook(selectedUnderlying, selectedExpiration, selectedStrike, 'call'),
				api.getOptionBook(selectedUnderlying, selectedExpiration, selectedStrike, 'put')
			]);

			callBook = transformBookData(callResp);
			putBook = transformBookData(putResp);
		} catch (e) {
			console.error('Failed to load order books:', e);
			// Use mock data
			callBook = generateMockBook('call');
			putBook = generateMockBook('put');
		}

		loading = false;
	}

	function transformBookData(resp: any): OrderBookData {
		const bidPrice = resp.quote.bid_price || 0;
		const askPrice = resp.quote.ask_price || 0;
		const spread = askPrice - bidPrice;
		const spreadPercent = bidPrice > 0 ? (spread / bidPrice) * 100 : 0;

		return {
			symbol: resp.symbol,
			bids: generateLevels(bidPrice, resp.quote.bid_size, 'bid'),
			asks: generateLevels(askPrice, resp.quote.ask_size, 'ask'),
			spread,
			spreadPercent,
			quote: resp.quote
		};
	}

	function generateLevels(basePrice: number, baseSize: number, side: 'bid' | 'ask'): OrderLevel[] {
		const levels: OrderLevel[] = [];
		let total = 0;
		const priceStep = side === 'bid' ? -2.5 : 2.5;

		for (let i = 0; i < 6; i++) {
			const size = baseSize * (1 + Math.random() * 0.5);
			total += size;
			levels.push({
				price: basePrice + i * priceStep,
				size: Math.round(size * 100) / 100,
				total: Math.round(total * 100) / 100
			});
		}

		return levels;
	}

	function generateMockBook(type: 'call' | 'put'): OrderBookData {
		const basePrice = type === 'call' ? 845 : 765;
		return {
			symbol: `${selectedUnderlying}-${selectedExpiration}-${selectedStrike}-${type.toUpperCase()}`,
			bids: generateLevels(basePrice, 5.2, 'bid'),
			asks: generateLevels(basePrice + 2, 3.5, 'ask'),
			spread: 2.0,
			spreadPercent: 0.24,
			quote: {
				bid_price: basePrice,
				ask_price: basePrice + 2,
				bid_size: 520,
				ask_size: 350
			}
		};
	}

	function getDepthWidth(size: number, maxSize: number): string {
		return `${Math.min((size / maxSize) * 100, 100)}%`;
	}

	$: if (selectedUnderlying) loadExpirations();
	$: if (selectedExpiration) loadStrikes();
	$: if (selectedStrike) loadOrderBooks();
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-white">Option Pair Depth Monitor</h1>
			<p class="text-text-muted text-sm mt-1">Real-time order book depth for Call/Put pairs</p>
		</div>
	</div>

	<!-- Controls Ribbon -->
	<div class="bg-surface-dark rounded-xl border border-border-dark p-4">
		<div class="flex flex-wrap items-end gap-4">
			<!-- Underlying -->
			<div class="flex flex-col gap-1.5 min-w-[140px]">
				<label class="text-text-muted text-xs font-semibold uppercase tracking-wider">Underlying</label>
				<select
					bind:value={selectedUnderlying}
					class="bg-background-dark border border-border-dark text-white text-sm rounded-lg p-2.5 font-bold focus:ring-primary focus:border-primary"
				>
					{#each underlyings as underlying}
						<option value={underlying}>{underlying}</option>
					{/each}
				</select>
			</div>

			<!-- Expiration -->
			<div class="flex flex-col gap-1.5 min-w-[140px]">
				<label class="text-text-muted text-xs font-semibold uppercase tracking-wider">Expiration</label>
				<select
					bind:value={selectedExpiration}
					class="bg-background-dark border border-border-dark text-white text-sm rounded-lg p-2.5 font-bold focus:ring-primary focus:border-primary"
				>
					{#each expirations as exp}
						<option value={exp}>{exp}</option>
					{/each}
				</select>
			</div>

			<!-- Strike -->
			<div class="flex flex-col gap-1.5 min-w-[140px]">
				<label class="text-text-muted text-xs font-semibold uppercase tracking-wider">Strike</label>
				<select
					bind:value={selectedStrike}
					class="bg-primary/20 border border-primary text-white text-sm rounded-lg p-2.5 font-bold focus:ring-primary focus:border-primary shadow-[0_0_15px_rgba(19,91,236,0.15)]"
				>
					{#each strikes as strike}
						<option value={strike}>{strike.toLocaleString()}</option>
					{/each}
				</select>
			</div>

			<!-- Stats Summary -->
			<div class="flex-1 flex justify-end">
				<div class="flex gap-4 items-center p-3 rounded-lg bg-border-dark/50 border border-border-dark/30">
					<div class="flex flex-col px-3 border-r border-border-dark">
						<span class="text-text-muted text-xs">Mark Price</span>
						<span class="text-white text-lg font-bold tabular-nums">$26,950.50</span>
					</div>
					<div class="flex flex-col px-3 border-r border-border-dark">
						<span class="text-text-muted text-xs">24h Change</span>
						<span class="text-success text-lg font-bold tabular-nums flex items-center gap-1">
							<span class="material-symbols-outlined text-sm">arrow_upward</span> 1.2%
						</span>
					</div>
					<div class="flex flex-col px-3">
						<span class="text-text-muted text-xs">IV Index</span>
						<span class="text-white text-lg font-bold tabular-nums">45.2%</span>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Order Books Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- CALL Order Book -->
		<div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
			<!-- Header -->
			<div class="px-5 py-4 border-b border-border-dark bg-gradient-to-r from-primary/10 to-transparent flex justify-between items-center">
				<div>
					<h3 class="text-primary text-xl font-bold">CALL {selectedStrike.toLocaleString()}</h3>
					<p class="text-text-muted text-xs mt-0.5">Expires in 2d 14h</p>
				</div>
				<span class="px-2 py-1 rounded bg-green-900/30 text-green-400 text-xs font-bold border border-green-900/50">ITM 98%</span>
			</div>

			<!-- Greeks -->
			<div class="grid grid-cols-4 gap-px bg-border-dark border-b border-border-dark">
				<div class="bg-surface-dark p-3 text-center">
					<div class="text-text-muted text-[10px] uppercase tracking-wider mb-1">Delta</div>
					<div class="text-white text-sm font-medium tabular-nums">{callGreeks.delta.toFixed(2)}</div>
				</div>
				<div class="bg-surface-dark p-3 text-center">
					<div class="text-text-muted text-[10px] uppercase tracking-wider mb-1">Gamma</div>
					<div class="text-white text-sm font-medium tabular-nums">{callGreeks.gamma.toFixed(2)}</div>
				</div>
				<div class="bg-surface-dark p-3 text-center">
					<div class="text-text-muted text-[10px] uppercase tracking-wider mb-1">Vega</div>
					<div class="text-white text-sm font-medium tabular-nums">{callGreeks.vega.toFixed(1)}</div>
				</div>
				<div class="bg-surface-dark p-3 text-center">
					<div class="text-text-muted text-[10px] uppercase tracking-wider mb-1">Theta</div>
					<div class="text-danger text-sm font-medium tabular-nums">{callGreeks.theta.toFixed(1)}</div>
				</div>
			</div>

			<!-- Order Book -->
			{#if callBook}
				<!-- Header -->
				<div class="grid grid-cols-3 px-4 py-2 bg-background-dark text-text-muted text-xs font-semibold uppercase tracking-wider border-b border-border-dark">
					<div class="text-left">Total</div>
					<div class="text-center">Price (USD)</div>
					<div class="text-right">Size</div>
				</div>

				<!-- Asks -->
				<div class="bg-background-dark">
					{#each [...callBook.asks].reverse() as ask, i}
						{@const maxSize = Math.max(...callBook.asks.map(a => a.total))}
						<div class="relative grid grid-cols-3 px-4 h-8 items-center text-sm font-medium hover:bg-border-dark/50 cursor-pointer group">
							<div class="absolute inset-y-0 right-0 bg-danger/10" style="width: {getDepthWidth(ask.total, maxSize)}"></div>
							<div class="z-10 text-white/50 tabular-nums">{ask.total.toFixed(2)}</div>
							<div class="z-10 text-danger text-center tabular-nums group-hover:font-bold">{ask.price.toFixed(2)}</div>
							<div class="z-10 text-white text-right tabular-nums">{ask.size.toFixed(2)}</div>
						</div>
					{/each}
				</div>

				<!-- Spread -->
				<div class="py-2 bg-surface-dark border-y border-border-dark flex justify-center items-center gap-4">
					<span class="text-text-muted text-xs font-medium uppercase tracking-widest">Spread</span>
					<span class="text-white text-sm font-bold tabular-nums">{callBook.spread.toFixed(2)}</span>
					<span class="text-text-muted text-xs">({callBook.spreadPercent.toFixed(2)}%)</span>
				</div>

				<!-- Bids -->
				<div class="bg-background-dark">
					{#each callBook.bids as bid}
						{@const maxSize = Math.max(...callBook.bids.map(b => b.total))}
						<div class="relative grid grid-cols-3 px-4 h-8 items-center text-sm font-medium hover:bg-border-dark/50 cursor-pointer group">
							<div class="absolute inset-y-0 right-0 bg-success/10" style="width: {getDepthWidth(bid.total, maxSize)}"></div>
							<div class="z-10 text-white/50 tabular-nums">{bid.total.toFixed(2)}</div>
							<div class="z-10 text-success text-center tabular-nums group-hover:font-bold">{bid.price.toFixed(2)}</div>
							<div class="z-10 text-white text-right tabular-nums">{bid.size.toFixed(2)}</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="p-8 text-center text-text-muted">
					{#if loading}
						Loading order book...
					{:else}
						Select an option to view order book
					{/if}
				</div>
			{/if}
		</div>

		<!-- PUT Order Book -->
		<div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
			<!-- Header -->
			<div class="px-5 py-4 border-b border-border-dark bg-gradient-to-r from-purple-600/10 to-transparent flex justify-between items-center">
				<div>
					<h3 class="text-purple-400 text-xl font-bold">PUT {selectedStrike.toLocaleString()}</h3>
					<p class="text-text-muted text-xs mt-0.5">Expires in 2d 14h</p>
				</div>
				<span class="px-2 py-1 rounded bg-red-900/30 text-red-400 text-xs font-bold border border-red-900/50">OTM 2%</span>
			</div>

			<!-- Greeks -->
			<div class="grid grid-cols-4 gap-px bg-border-dark border-b border-border-dark">
				<div class="bg-surface-dark p-3 text-center">
					<div class="text-text-muted text-[10px] uppercase tracking-wider mb-1">Delta</div>
					<div class="text-white text-sm font-medium tabular-nums">{putGreeks.delta.toFixed(2)}</div>
				</div>
				<div class="bg-surface-dark p-3 text-center">
					<div class="text-text-muted text-[10px] uppercase tracking-wider mb-1">Gamma</div>
					<div class="text-white text-sm font-medium tabular-nums">{putGreeks.gamma.toFixed(2)}</div>
				</div>
				<div class="bg-surface-dark p-3 text-center">
					<div class="text-text-muted text-[10px] uppercase tracking-wider mb-1">Vega</div>
					<div class="text-white text-sm font-medium tabular-nums">{putGreeks.vega.toFixed(1)}</div>
				</div>
				<div class="bg-surface-dark p-3 text-center">
					<div class="text-text-muted text-[10px] uppercase tracking-wider mb-1">Theta</div>
					<div class="text-danger text-sm font-medium tabular-nums">{putGreeks.theta.toFixed(1)}</div>
				</div>
			</div>

			<!-- Order Book -->
			{#if putBook}
				<!-- Header -->
				<div class="grid grid-cols-3 px-4 py-2 bg-background-dark text-text-muted text-xs font-semibold uppercase tracking-wider border-b border-border-dark">
					<div class="text-left">Total</div>
					<div class="text-center">Price (USD)</div>
					<div class="text-right">Size</div>
				</div>

				<!-- Asks -->
				<div class="bg-background-dark">
					{#each [...putBook.asks].reverse() as ask}
						{@const maxSize = Math.max(...putBook.asks.map(a => a.total))}
						<div class="relative grid grid-cols-3 px-4 h-8 items-center text-sm font-medium hover:bg-border-dark/50 cursor-pointer group">
							<div class="absolute inset-y-0 right-0 bg-danger/10" style="width: {getDepthWidth(ask.total, maxSize)}"></div>
							<div class="z-10 text-white/50 tabular-nums">{ask.total.toFixed(2)}</div>
							<div class="z-10 text-danger text-center tabular-nums group-hover:font-bold">{ask.price.toFixed(2)}</div>
							<div class="z-10 text-white text-right tabular-nums">{ask.size.toFixed(2)}</div>
						</div>
					{/each}
				</div>

				<!-- Spread -->
				<div class="py-2 bg-surface-dark border-y border-border-dark flex justify-center items-center gap-4">
					<span class="text-text-muted text-xs font-medium uppercase tracking-widest">Spread</span>
					<span class="text-white text-sm font-bold tabular-nums">{putBook.spread.toFixed(2)}</span>
					<span class="text-text-muted text-xs">({putBook.spreadPercent.toFixed(2)}%)</span>
				</div>

				<!-- Bids -->
				<div class="bg-background-dark">
					{#each putBook.bids as bid}
						{@const maxSize = Math.max(...putBook.bids.map(b => b.total))}
						<div class="relative grid grid-cols-3 px-4 h-8 items-center text-sm font-medium hover:bg-border-dark/50 cursor-pointer group">
							<div class="absolute inset-y-0 right-0 bg-success/10" style="width: {getDepthWidth(bid.total, maxSize)}"></div>
							<div class="z-10 text-white/50 tabular-nums">{bid.total.toFixed(2)}</div>
							<div class="z-10 text-success text-center tabular-nums group-hover:font-bold">{bid.price.toFixed(2)}</div>
							<div class="z-10 text-white text-right tabular-nums">{bid.size.toFixed(2)}</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="p-8 text-center text-text-muted">
					{#if loading}
						Loading order book...
					{:else}
						Select an option to view order book
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
