<script lang="ts">
	import { onMount } from 'svelte';
	import { controlsStore } from '$lib/stores/controls';
	import { systemStore } from '$lib/stores/system';
	import { marketStore, priceList, isConnected } from '$lib/stores/market';

	let spreadValue = $state(1.0);
	let sizeValue = $state(100);
	let skewValue = $state(0);

	onMount(() => {
		marketStore.init();
		return () => marketStore.disconnect();
	});

	function handleSpreadChange(e: Event) {
		const target = e.target as HTMLInputElement;
		spreadValue = parseFloat(target.value);
		controlsStore.setSpreadMultiplier(spreadValue);
	}

	function handleSizeChange(e: Event) {
		const target = e.target as HTMLInputElement;
		sizeValue = parseInt(target.value);
		controlsStore.setSizeScalar(sizeValue);
	}

	function handleSkewChange(e: Event) {
		const target = e.target as HTMLInputElement;
		skewValue = parseFloat(target.value);
		controlsStore.setDirectionalSkew(skewValue);
	}
</script>

<div class="p-6 max-w-[1200px] mx-auto flex flex-col gap-8">
	<!-- Header -->
	<div
		class="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 pb-2 border-b border-border-dark/50"
	>
		<div class="flex flex-col gap-2">
			<h1 class="text-white text-4xl font-black leading-tight tracking-tight">
				Operational Controls
			</h1>
			<p class="text-text-muted text-base font-normal">
				Manage global quoting parameters, emergency overrides, and monitor system latency.
			</p>
		</div>
		<!-- System Health Indicators -->
		<div class="flex flex-wrap gap-4">
			<div
				class="flex items-center gap-3 bg-surface-dark border border-border-dark rounded-full px-4 py-2"
			>
				<div class="flex items-center gap-2">
					<span class="relative flex h-3 w-3">
						{#if $systemStore.connected}
							<span
								class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"
							></span>
						{/if}
						<span
							class="relative inline-flex rounded-full h-3 w-3 {$systemStore.connected
								? 'bg-success'
								: 'bg-danger'}"
						></span>
					</span>
					<span class="text-xs font-bold text-slate-300 uppercase tracking-wider">Exchange API</span
					>
				</div>
				<div class="h-4 w-px bg-border-dark"></div>
				<span class="text-sm font-mono text-white"
					>{$systemStore.connected ? 'Connected' : 'Disconnected'}</span
				>
			</div>
			<div
				class="flex items-center gap-3 bg-surface-dark border border-border-dark rounded-full px-4 py-2"
			>
				<span class="material-symbols-outlined text-primary text-sm">speed</span>
				<div class="flex flex-col leading-none">
					<span class="text-[10px] text-slate-400 uppercase font-bold">Latency</span>
					<span class="text-sm font-mono text-white">{$systemStore.latency}ms</span>
				</div>
			</div>
			<div
				class="flex items-center gap-3 bg-surface-dark border border-border-dark rounded-full px-4 py-2"
			>
				<span class="material-symbols-outlined text-slate-400 text-sm">memory</span>
				<div class="flex flex-col leading-none">
					<span class="text-[10px] text-slate-400 uppercase font-bold">Engine Load</span>
					<span class="text-sm font-mono text-white">{$systemStore.engineLoad}%</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Top Row: Master Switch & Key Metrics -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Master Kill Switch -->
		<div
			class="lg:col-span-1 bg-surface-dark border {$controlsStore.masterSwitch
				? 'border-success/30'
				: 'border-danger/30'} rounded-xl p-6 flex flex-col justify-between relative overflow-hidden group"
		>
			<div
				class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"
			>
				<span
					class="material-symbols-outlined {$controlsStore.masterSwitch
						? 'text-success'
						: 'text-danger'} text-6xl">warning</span
				>
			</div>
			<div class="flex flex-col gap-1 z-10">
				<div
					class="flex items-center gap-2 {$controlsStore.masterSwitch
						? 'text-success'
						: 'text-danger'} mb-2"
				>
					<span class="material-symbols-outlined">gpp_maybe</span>
					<span class="text-xs font-bold uppercase tracking-widest">Emergency Override</span>
				</div>
				<h3 class="text-white text-xl font-bold leading-tight">Master Quoting Switch</h3>
				<p class="text-text-muted text-sm mt-1">
					Global toggle. Turning this off immediately cancels all open orders and halts new quotes.
				</p>
			</div>
			<div
				class="mt-6 flex items-center justify-between bg-background-dark/50 p-3 rounded-lg border border-border-dark z-10"
			>
				<span class="text-sm font-medium text-white flex items-center gap-2">
					Status: <span
						class="{$controlsStore.masterSwitch ? 'text-success' : 'text-danger'} font-bold"
						>{$controlsStore.masterSwitch ? 'ACTIVE' : 'HALTED'}</span
					>
				</span>
				<button
					onclick={() => controlsStore.toggleMasterSwitch()}
					class="relative flex h-[31px] w-[51px] cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 {$controlsStore.masterSwitch
						? 'justify-end bg-success'
						: 'justify-start bg-[#232f48]'}"
				>
					<div class="h-full w-[27px] rounded-full bg-white shadow-sm"></div>
				</button>
			</div>
		</div>

		<!-- Live Prices from Backend -->
		<div class="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
			{#each $priceList as priceData}
				<div class="bg-surface-dark border border-border-dark rounded-xl p-4 flex flex-col gap-3">
					<div class="flex items-center justify-between text-text-muted">
						<span class="text-xs font-bold uppercase">{priceData.symbol}</span>
						<span class="material-symbols-outlined text-lg">currency_exchange</span>
					</div>
					<div>
						<span class="text-2xl font-bold text-white block font-mono">
							${priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
						</span>
						{#if priceData.change !== 0}
							<span class="text-xs {priceData.change >= 0 ? 'text-success' : 'text-danger'} flex items-center gap-1 mt-1">
								<span class="material-symbols-outlined text-xs">
									{priceData.change >= 0 ? 'trending_up' : 'trending_down'}
								</span>
								{priceData.change >= 0 ? '+' : ''}{priceData.changePercent.toFixed(2)}%
							</span>
						{:else}
							<span class="text-xs text-slate-400 mt-1 block">Live Price</span>
						{/if}
					</div>
				</div>
			{:else}
				<div class="bg-surface-dark border border-border-dark rounded-xl p-4 flex flex-col gap-3 col-span-full">
					<div class="flex items-center justify-center text-text-muted py-4">
						<span class="material-symbols-outlined animate-spin mr-2">sync</span>
						<span class="text-sm">Loading prices from backend...</span>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Controls Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
		<!-- Left Column: Global Parameters -->
		<div class="lg:col-span-8 flex flex-col gap-6">
			<div class="flex items-center justify-between">
				<h3 class="text-white text-xl font-bold">Global Parameter Adjustments</h3>
				<button
					class="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
				>
					<span class="material-symbols-outlined text-sm">history</span> Reset Defaults
				</button>
			</div>

			<!-- Spread Multiplier -->
			<div class="bg-surface-dark border border-border-dark rounded-xl p-6">
				<div class="flex justify-between items-start mb-6">
					<div class="flex flex-col">
						<label class="text-base font-bold text-white flex items-center gap-2">
							Spread Multiplier
							<span class="material-symbols-outlined text-slate-500 text-sm">info</span>
						</label>
						<span class="text-sm text-text-muted"
							>Scales the bid-ask spread. &gt;1.0 widens quotes.</span
						>
					</div>
					<div
						class="flex items-center gap-2 bg-background-dark border border-border-dark rounded-lg px-3 py-1"
					>
						<span class="text-xl font-mono font-bold text-primary">{spreadValue.toFixed(2)}</span>
						<span class="text-xs text-slate-500">x</span>
					</div>
				</div>
				<div class="flex items-center gap-4">
					<span class="text-xs text-slate-500 font-mono">0.5x</span>
					<input
						type="range"
						min="0.5"
						max="5.0"
						step="0.1"
						value={spreadValue}
						oninput={handleSpreadChange}
						class="flex-1 accent-primary h-2 bg-border-dark rounded-lg appearance-none cursor-pointer"
					/>
					<span class="text-xs text-slate-500 font-mono">5.0x</span>
				</div>
			</div>

			<!-- Row of smaller parameters -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<!-- Size Scalar -->
				<div class="bg-surface-dark border border-border-dark rounded-xl p-6">
					<div class="flex justify-between items-center mb-4">
						<label class="text-sm font-bold text-white">Global Size Scalar</label>
						<div
							class="bg-background-dark border border-border-dark rounded px-2 py-1 text-sm font-mono text-white"
						>
							{sizeValue}%
						</div>
					</div>
					<input
						type="range"
						min="0"
						max="100"
						step="10"
						value={sizeValue}
						oninput={handleSizeChange}
						class="w-full accent-primary h-2 bg-border-dark rounded-lg appearance-none cursor-pointer mb-2"
					/>
					<p class="text-xs text-text-muted">Reduces quoted quantity (%) on all orders.</p>
				</div>

				<!-- Directional Skew -->
				<div class="bg-surface-dark border border-border-dark rounded-xl p-6">
					<div class="flex justify-between items-center mb-4">
						<label class="text-sm font-bold text-white">Directional Skew</label>
						<div
							class="bg-background-dark border border-border-dark rounded px-2 py-1 text-sm font-mono text-white"
						>
							{skewValue.toFixed(2)}
						</div>
					</div>
					<div class="relative pt-6">
						<input
							type="range"
							min="-1"
							max="1"
							step="0.1"
							value={skewValue}
							oninput={handleSkewChange}
							class="w-full accent-primary h-2 bg-border-dark rounded-lg appearance-none cursor-pointer z-10 relative"
						/>
						<div class="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-slate-600 z-0"
						></div>
					</div>
					<div class="flex justify-between mt-2 text-xs text-text-muted">
						<span>Bearish</span>
						<span>Neutral</span>
						<span>Bullish</span>
					</div>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="flex flex-wrap gap-4 mt-2">
				<button
					class="flex-1 bg-surface-dark hover:bg-border-dark text-white border border-border-dark font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
				>
					<span class="material-symbols-outlined text-sm">replay</span>
					Recalibrate Vol Surface
				</button>
				<button
					class="flex-1 bg-surface-dark hover:bg-border-dark text-white border border-border-dark font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
				>
					<span class="material-symbols-outlined text-sm">cancel_presentation</span>
					Cancel All Limit Orders
				</button>
			</div>
		</div>

		<!-- Right Column: Instrument Controls -->
		<div class="lg:col-span-4 flex flex-col gap-6">
			<h3 class="text-white text-xl font-bold">Instrument Controls</h3>
			<div class="bg-surface-dark border border-border-dark rounded-xl overflow-hidden flex flex-col">
				<div class="p-4 border-b border-border-dark bg-background-dark/30">
					<span class="text-xs font-bold uppercase text-slate-400 tracking-wider"
						>Per-Asset Quoting Status</span
					>
				</div>
				{#each $controlsStore.instruments as instrument}
					<div
						class="p-4 border-b border-border-dark flex items-center justify-between hover:bg-white/5 transition-colors {!instrument.isQuotingEnabled
							? 'bg-danger/5'
							: ''}"
					>
						<div class="flex items-center gap-3">
							<div
								class="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs"
							>
								{instrument.symbol.charAt(0)}
							</div>
							<div class="flex flex-col">
								<span class="text-sm font-bold text-white">{instrument.displayName}</span>
								{#if instrument.isQuotingEnabled}
									<span class="text-xs text-text-muted">{instrument.exchanges.join(' & ')}</span>
								{:else}
									<span class="text-xs text-danger font-medium flex items-center gap-1">
										<span class="material-symbols-outlined text-[10px]">pause</span> Paused
									</span>
								{/if}
							</div>
						</div>
						<button
							onclick={() => controlsStore.toggleInstrument(instrument.symbol)}
							class="relative flex h-6 w-11 cursor-pointer items-center rounded-full p-0.5 transition-colors {instrument.isQuotingEnabled
								? 'justify-end bg-success'
								: 'justify-start bg-[#232f48]'}"
						>
							<div class="h-5 w-5 rounded-full bg-white shadow-sm"></div>
						</button>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
