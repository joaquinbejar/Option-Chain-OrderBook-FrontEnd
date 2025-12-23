<script lang="ts">
	const executions = [
		{ time: '10:42:01.452', instrument: 'TSLA 240C', side: 'BUY', size: 10, execPx: 5.30, theoVal: 5.35, edge: 0.05, latency: 12 },
		{ time: '10:42:00.110', instrument: 'AAPL 180P', side: 'SELL', size: 50, execPx: 2.10, theoVal: 2.12, edge: -0.02, latency: 8 },
		{ time: '10:41:58.905', instrument: 'NVDA 450C', side: 'SELL', size: 5, execPx: 12.50, theoVal: 12.48, edge: 0.02, latency: 15 },
		{ time: '10:41:55.200', instrument: 'SPY 440P', side: 'BUY', size: 100, execPx: 1.85, theoVal: 1.85, edge: 0.00, latency: 5 },
		{ time: '10:41:50.001', instrument: 'AMZN 140C', side: 'BUY', size: 20, execPx: 3.15, theoVal: 3.20, edge: 0.05, latency: 22 },
		{ time: '10:41:48.332', instrument: 'GOOGL 130C', side: 'SELL', size: 15, execPx: 4.50, theoVal: 4.50, edge: 0.00, latency: 145 },
		{ time: '10:41:45.105', instrument: 'META 300P', side: 'BUY', size: 5, execPx: 8.20, theoVal: 8.35, edge: 0.15, latency: 9 },
		{ time: '10:41:42.020', instrument: 'AMD 100C', side: 'SELL', size: 200, execPx: 1.45, theoVal: 1.44, edge: 0.01, latency: 4 },
		{ time: '10:41:40.880', instrument: 'MSFT 330P', side: 'BUY', size: 30, execPx: 6.80, theoVal: 6.75, edge: -0.05, latency: 18 }
	];
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

	<!-- KPI Stats -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		<div class="flex flex-col justify-between rounded-xl bg-surface-dark border border-border-dark p-5">
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-sm font-medium">Fill Rate %</p>
				<span class="material-symbols-outlined text-text-muted text-[20px]">percent</span>
			</div>
			<div class="flex items-baseline gap-2">
				<p class="text-white text-2xl font-bold tabular-nums">84.2%</p>
				<span class="text-success text-xs font-medium bg-success/10 px-1.5 py-0.5 rounded flex items-center">
					<span class="material-symbols-outlined text-[12px] mr-0.5">trending_up</span>
					2.1%
				</span>
			</div>
			<div class="mt-3 h-1 w-full bg-background-dark rounded-full overflow-hidden">
				<div class="h-full bg-success w-[84%]"></div>
			</div>
		</div>
		<div class="flex flex-col justify-between rounded-xl bg-surface-dark border border-border-dark p-5">
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-sm font-medium">Adverse Selection Ratio</p>
				<span class="material-symbols-outlined text-text-muted text-[20px]">warning</span>
			</div>
			<div class="flex items-baseline gap-2">
				<p class="text-white text-2xl font-bold tabular-nums">12.0%</p>
				<span class="text-success text-xs font-medium bg-success/10 px-1.5 py-0.5 rounded">-0.5%</span>
			</div>
			<div class="mt-3 h-1 w-full bg-background-dark rounded-full overflow-hidden">
				<div class="h-full bg-warning w-[12%]"></div>
			</div>
		</div>
		<div class="flex flex-col justify-between rounded-xl bg-surface-dark border border-border-dark p-5">
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-sm font-medium">Avg Edge Captured</p>
				<span class="material-symbols-outlined text-text-muted text-[20px]">price_check</span>
			</div>
			<div class="flex items-baseline gap-2">
				<p class="text-white text-2xl font-bold tabular-nums text-success">+0.05</p>
				<span class="text-text-muted text-xs font-normal">ticks per lot</span>
			</div>
			<div class="mt-3 flex gap-0.5 h-1 w-full bg-background-dark rounded-full overflow-hidden">
				<div class="h-full bg-danger w-[20%] opacity-50"></div>
				<div class="h-full bg-success w-[80%]"></div>
			</div>
		</div>
		<div class="flex flex-col justify-between rounded-xl bg-surface-dark border border-border-dark p-5">
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-sm font-medium">Est. Queue Position</p>
				<span class="material-symbols-outlined text-text-muted text-[20px]">layers</span>
			</div>
			<div class="flex items-baseline gap-2">
				<p class="text-white text-2xl font-bold tabular-nums">Top 10%</p>
				<span class="text-success text-xs font-medium bg-success/10 px-1.5 py-0.5 rounded">Strong</span>
			</div>
			<div class="mt-3 h-1 w-full bg-background-dark rounded-full overflow-hidden flex">
				<div class="h-full bg-primary w-[33%]"></div>
				<div class="h-full bg-primary/30 w-[33%]"></div>
				<div class="h-full bg-primary/10 w-[34%]"></div>
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
