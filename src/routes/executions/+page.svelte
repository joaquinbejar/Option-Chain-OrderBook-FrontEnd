<script lang="ts">
	// Empty executions - no trades yet
	const executions: any[] = [];
</script>

<div class="p-6 max-w-[1600px] mx-auto w-full flex flex-col gap-6">
	<!-- Header -->
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-white text-2xl sm:text-3xl font-bold leading-tight">Execution Monitor</h1>
			<p class="text-text-muted text-sm font-normal max-w-2xl">
				Real-time audit trail of trade execution quality, fill latency, and P&L edge attribution.
			</p>
		</div>
		<div class="flex gap-3">
			<button class="flex items-center gap-2 h-9 px-4 rounded-lg bg-surface-dark border border-border-dark text-white text-sm font-medium hover:bg-[#2a3649] transition-colors">
				<span class="material-symbols-outlined text-[18px]">pause_circle</span>
				<span>Pause Algo</span>
			</button>
			<button class="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-medium transition-colors shadow-lg shadow-blue-900/20">
				<span class="material-symbols-outlined text-[18px]">download</span>
				<span>Export Logs</span>
			</button>
		</div>
	</div>

	<!-- KPI Stats - Empty State -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		<div class="flex flex-col justify-between rounded-xl bg-surface-dark border border-border-dark p-5">
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-sm font-medium">Fill Rate %</p>
				<span class="material-symbols-outlined text-text-muted text-[20px]">percent</span>
			</div>
			<div class="flex items-baseline gap-2">
				<p class="text-text-muted text-2xl font-bold tabular-nums">--</p>
				<span class="text-text-muted text-xs font-normal">No fills</span>
			</div>
			<div class="mt-3 h-1 w-full bg-background-dark rounded-full overflow-hidden">
				<div class="h-full bg-slate-600 w-[0%]"></div>
			</div>
		</div>
		<div class="flex flex-col justify-between rounded-xl bg-surface-dark border border-border-dark p-5">
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-sm font-medium">Adverse Selection Ratio</p>
				<span class="material-symbols-outlined text-text-muted text-[20px]">warning</span>
			</div>
			<div class="flex items-baseline gap-2">
				<p class="text-text-muted text-2xl font-bold tabular-nums">--</p>
				<span class="text-text-muted text-xs font-normal">No data</span>
			</div>
			<div class="mt-3 h-1 w-full bg-background-dark rounded-full overflow-hidden">
				<div class="h-full bg-slate-600 w-[0%]"></div>
			</div>
		</div>
		<div class="flex flex-col justify-between rounded-xl bg-surface-dark border border-border-dark p-5">
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-sm font-medium">Avg Edge Captured</p>
				<span class="material-symbols-outlined text-text-muted text-[20px]">price_check</span>
			</div>
			<div class="flex items-baseline gap-2">
				<p class="text-text-muted text-2xl font-bold tabular-nums">$0.00</p>
				<span class="text-text-muted text-xs font-normal">No trades</span>
			</div>
			<div class="mt-3 h-1 w-full bg-background-dark rounded-full overflow-hidden">
				<div class="h-full bg-slate-600 w-[0%]"></div>
			</div>
		</div>
		<div class="flex flex-col justify-between rounded-xl bg-surface-dark border border-border-dark p-5">
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-sm font-medium">Est. Queue Position</p>
				<span class="material-symbols-outlined text-text-muted text-[20px]">layers</span>
			</div>
			<div class="flex items-baseline gap-2">
				<p class="text-text-muted text-2xl font-bold tabular-nums">--</p>
				<span class="text-text-muted text-xs font-normal">Inactive</span>
			</div>
			<div class="mt-3 h-1 w-full bg-background-dark rounded-full overflow-hidden">
				<div class="h-full bg-slate-600 w-[0%]"></div>
			</div>
		</div>
	</div>

	<!-- Data Grid -->
	<div class="w-full overflow-hidden rounded-xl border border-border-dark bg-surface-dark shadow-xl shadow-black/20">
		<div class="overflow-x-auto">
			<table class="w-full text-left border-collapse">
				<thead>
					<tr class="border-b border-border-dark bg-[#151b26]">
						<th class="whitespace-nowrap px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Time (UTC)</th>
						<th class="whitespace-nowrap px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Instrument</th>
						<th class="whitespace-nowrap px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Side</th>
						<th class="whitespace-nowrap px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider text-right">Size</th>
						<th class="whitespace-nowrap px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider text-right">Exec Px</th>
						<th class="whitespace-nowrap px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider text-right">Theo Val</th>
						<th class="whitespace-nowrap px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider text-right">Edge</th>
						<th class="whitespace-nowrap px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider text-right">Latency</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border-dark">
					{#each executions as exec}
						<tr class="hover:bg-[#232f48] group transition-colors">
							<td class="whitespace-nowrap px-4 py-2.5 text-sm text-text-muted tabular-nums">{exec.time}</td>
							<td class="whitespace-nowrap px-4 py-2.5 text-sm font-bold text-white">{exec.instrument}</td>
							<td class="whitespace-nowrap px-4 py-2.5">
								<span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset {exec.side === 'BUY' ? 'bg-success/10 text-success ring-success/20' : 'bg-danger/10 text-danger ring-danger/20'}">{exec.side}</span>
							</td>
							<td class="whitespace-nowrap px-4 py-2.5 text-sm text-white text-right tabular-nums">{exec.size}</td>
							<td class="whitespace-nowrap px-4 py-2.5 text-sm text-white text-right tabular-nums font-medium">${exec.execPx.toFixed(2)}</td>
							<td class="whitespace-nowrap px-4 py-2.5 text-sm text-text-muted text-right tabular-nums">${exec.theoVal.toFixed(2)}</td>
							<td class="whitespace-nowrap px-4 py-2.5 text-right">
								<div class="flex items-center justify-end gap-1">
									<span class="text-sm font-bold tabular-nums {exec.edge > 0 ? 'text-success' : exec.edge < 0 ? 'text-danger' : 'text-text-muted'}">{exec.edge > 0 ? '+' : ''}${exec.edge.toFixed(2)}</span>
									<div class="h-1.5 w-1.5 rounded-full {exec.edge > 0 ? 'bg-success' : exec.edge < 0 ? 'bg-danger' : 'bg-slate-600'}"></div>
								</div>
							</td>
							<td class="whitespace-nowrap px-4 py-2.5 text-sm text-right tabular-nums {exec.latency > 100 ? 'text-warning font-bold' : 'text-text-muted'}">{exec.latency}ms</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<!-- Pagination -->
		<div class="flex items-center justify-between border-t border-border-dark bg-[#151b26] px-4 py-3 sm:px-6">
			<div>
				<p class="text-sm text-text-muted">
					Showing <span class="font-medium text-white">1</span> to <span class="font-medium text-white">9</span> of <span class="font-medium text-white">1,248</span> fills
				</p>
			</div>
			<div class="flex gap-1">
				<button class="px-3 py-1 rounded bg-primary text-white text-sm font-semibold">1</button>
				<button class="px-3 py-1 rounded text-text-muted hover:bg-[#232f48] text-sm">2</button>
				<button class="px-3 py-1 rounded text-text-muted hover:bg-[#232f48] text-sm">3</button>
				<span class="px-3 py-1 text-text-muted text-sm">...</span>
				<button class="px-3 py-1 rounded text-text-muted hover:bg-[#232f48] text-sm">124</button>
			</div>
		</div>
	</div>
</div>
