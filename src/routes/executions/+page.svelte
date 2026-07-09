<script lang="ts">
	import { onMount } from 'svelte';
	import { executionsStore, avgEdge, MAX_FILLS } from '$lib/stores/executions';
	import { systemStore } from '$lib/stores/system';

	onMount(() => {
		// The counters claim "since this view opened" — make that true on every
		// visit, not just the first mount of the module singleton.
		executionsStore.reset();
		executionsStore.init();
		return () => executionsStore.disconnect();
	});

	function formatTime(ms: number): string {
		return new Date(ms).toLocaleTimeString('en-US', { hour12: false });
	}

	function formatMoney(value: number): string {
		return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	// Desk convention: -$0.05, never $-0.05; exact zero carries no sign.
	function formatSignedMoney(value: number): string {
		const sign = value > 0 ? '+' : value < 0 ? '-' : '';
		return `${sign}$${formatMoney(Math.abs(value))}`;
	}

	function sideClasses(side: string): string {
		if (side === 'BUY') return 'bg-success/10 text-success ring-success/20';
		if (side === 'SELL') return 'bg-danger/10 text-danger ring-danger/20';
		// Unknown side value — fail muted, not as a sell.
		return 'bg-border-dark/50 text-text-muted ring-border-dark';
	}
</script>

<div class="p-6 max-w-[1600px] mx-auto w-full flex flex-col gap-6">
	<!-- Header -->
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-white text-2xl sm:text-3xl font-bold leading-tight">Execution Monitor</h1>
			<p class="text-text-muted text-sm font-normal max-w-2xl">
				Live session fills streamed over the WebSocket while this view is open. Rows are stamped
				with local receipt time and are not persisted.
			</p>
		</div>
		<div
			role="status"
			class="flex items-center gap-2 px-3 py-1.5 rounded-full {!$systemStore.connected
				? 'bg-danger/10 text-danger'
				: $systemStore.latencyStale
					? 'bg-warning/10 text-warning'
					: 'bg-success/10 text-success'}"
		>
			<span
				class="relative inline-flex rounded-full h-2 w-2 {!$systemStore.connected
					? 'bg-danger'
					: $systemStore.latencyStale
						? 'bg-warning'
						: 'bg-success'}"
			></span>
			<span class="text-xs font-bold uppercase tracking-wider"
				>{!$systemStore.connected
					? 'Feed disconnected'
					: $systemStore.latencyStale
						? 'Feed stale'
						: 'Feed connected'}</span
			>
		</div>
	</div>

	<!-- KPI Stats -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		<div
			class="flex flex-col justify-between rounded-xl bg-surface-dark border border-border-dark p-5"
		>
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-sm font-medium">Fills Received</p>
				<span class="material-symbols-outlined text-text-muted text-[20px]">receipt_long</span>
			</div>
			<div class="flex items-baseline gap-2">
				<p class="text-white text-2xl font-bold tabular-nums">
					{$executionsStore.totalReceived.toLocaleString()}
				</p>
				<span class="text-text-muted text-xs font-normal">since this view opened</span>
			</div>
		</div>
		<div
			class="flex flex-col justify-between rounded-xl bg-surface-dark border border-border-dark p-5"
		>
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-sm font-medium">Avg Edge Captured</p>
				<span class="material-symbols-outlined text-text-muted text-[20px]">price_check</span>
			</div>
			<div class="flex items-baseline gap-2">
				{#if $avgEdge !== null}
					<p
						class="text-2xl font-bold tabular-nums {$avgEdge > 0
							? 'text-success'
							: $avgEdge < 0
								? 'text-danger'
								: 'text-text-muted'}"
					>
						{formatSignedMoney($avgEdge)}
					</p>
					<span class="text-text-muted text-xs font-normal">per fill</span>
				{:else}
					<p class="text-text-muted text-2xl font-bold tabular-nums">—</p>
					<span class="text-text-muted text-xs font-normal">No fills</span>
				{/if}
			</div>
		</div>
		<div
			class="flex flex-col justify-between rounded-xl bg-surface-dark border border-border-dark p-5"
		>
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-sm font-medium">Fill Rate %</p>
				<span class="material-symbols-outlined text-text-muted text-[20px]">percent</span>
			</div>
			<div class="flex items-baseline gap-2">
				<p class="text-text-muted text-2xl font-bold tabular-nums">—</p>
				<span class="text-text-muted text-xs font-normal">Not provided by the backend</span>
			</div>
		</div>
		<div
			class="flex flex-col justify-between rounded-xl bg-surface-dark border border-border-dark p-5"
		>
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-sm font-medium">Adverse Selection</p>
				<span class="material-symbols-outlined text-text-muted text-[20px]">warning</span>
			</div>
			<div class="flex items-baseline gap-2">
				<p class="text-text-muted text-2xl font-bold tabular-nums">—</p>
				<span class="text-text-muted text-xs font-normal">Not provided by the backend</span>
			</div>
		</div>
	</div>

	<!-- Data Grid -->
	<div
		class="w-full overflow-hidden rounded-xl border border-border-dark bg-surface-dark shadow-xl shadow-black/20"
	>
		<div class="overflow-x-auto">
			<table class="w-full text-left border-collapse">
				<thead>
					<tr class="border-b border-border-dark bg-[#151b26]">
						<th
							class="whitespace-nowrap px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider"
							>Received (local)</th
						>
						<th
							class="whitespace-nowrap px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider"
							>Instrument</th
						>
						<th
							class="whitespace-nowrap px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider"
							>Side</th
						>
						<th
							class="whitespace-nowrap px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider text-right"
							>Size</th
						>
						<th
							class="whitespace-nowrap px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider text-right"
							>Exec Px</th
						>
						<th
							class="whitespace-nowrap px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider text-right"
							>Edge</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-border-dark">
					{#each $executionsStore.fills as fill (fill.seq)}
						<tr class="hover:bg-[#232f48] transition-colors">
							<td class="whitespace-nowrap px-4 py-2.5 text-sm text-text-muted tabular-nums"
								>{formatTime(fill.receivedAt)}</td
							>
							<td class="whitespace-nowrap px-4 py-2.5 text-sm font-bold text-white"
								>{fill.instrument}</td
							>
							<td class="whitespace-nowrap px-4 py-2.5">
								<span
									class="inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset {sideClasses(
										fill.side
									)}">{fill.side}</span
								>
							</td>
							<td class="whitespace-nowrap px-4 py-2.5 text-sm text-white text-right tabular-nums"
								>{fill.quantity.toLocaleString()}</td
							>
							<td
								class="whitespace-nowrap px-4 py-2.5 text-sm text-white text-right tabular-nums font-medium"
								>${formatMoney(fill.price)}</td
							>
							<td class="whitespace-nowrap px-4 py-2.5 text-right">
								<span
									class="text-sm font-bold tabular-nums {fill.edge > 0
										? 'text-success'
										: fill.edge < 0
											? 'text-danger'
											: 'text-text-muted'}">{formatSignedMoney(fill.edge)}</span
								>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="6" class="px-4 py-10 text-center text-text-muted text-sm">
								{#if $systemStore.connected}
									No fills received while this view has been open — executions stream in live as the
									engine trades.
								{:else}
									Feed disconnected — fills cannot arrive until the WebSocket reconnects.
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<!-- Footer: honest counts, no fake pagination -->
		<div
			class="flex items-center justify-between border-t border-border-dark bg-[#151b26] px-4 py-3 sm:px-6"
		>
			<p class="text-sm text-text-muted">
				Showing <span class="font-medium text-white">{$executionsStore.fills.length}</span> of
				<span class="font-medium text-white">{$executionsStore.totalReceived.toLocaleString()}</span
				>
				fills received since this view opened
			</p>
			{#if $executionsStore.totalReceived > MAX_FILLS}
				<p class="text-xs text-text-muted">Oldest rows beyond {MAX_FILLS} are dropped</p>
			{/if}
		</div>
	</div>
</div>
