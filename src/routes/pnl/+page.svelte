<script lang="ts">
	// Empty strategies - no P&L data yet
	const strategies: any[] = [];
</script>

<div class="p-6 max-w-[1400px] mx-auto flex flex-col gap-6">
	<!-- Header -->
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-white text-2xl sm:text-3xl font-bold leading-tight">P&L Decomposition</h1>
			<p class="text-text-muted text-sm">Understand where P&L is coming from: theta, delta, vega, spread capture.</p>
		</div>
		<div class="flex gap-2">
			<button class="h-9 px-4 rounded-lg bg-primary/20 border border-primary/30 text-primary text-sm font-bold">Total</button>
			<button class="h-9 px-4 rounded-lg bg-surface-dark border border-border-dark text-text-muted hover:text-white text-sm font-medium">Realized</button>
			<button class="h-9 px-4 rounded-lg bg-surface-dark border border-border-dark text-text-muted hover:text-white text-sm font-medium">Unrealized</button>
		</div>
	</div>

	<!-- Summary Cards - Empty State -->
	<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
		<div class="bg-surface-dark border border-border-dark rounded-xl p-5 relative overflow-hidden">
			<p class="text-text-muted text-sm font-medium mb-2">Total P&L</p>
			<p class="text-text-muted text-3xl font-bold">$0.00</p>
			<p class="text-text-muted text-sm mt-1">No activity</p>
		</div>
		<div class="bg-surface-dark border border-border-dark rounded-xl p-5">
			<p class="text-text-muted text-sm font-medium mb-2">Theta</p>
			<p class="text-text-muted text-2xl font-bold">$0.00</p>
			<p class="text-text-muted text-sm mt-1">--</p>
		</div>
		<div class="bg-surface-dark border border-border-dark rounded-xl p-5">
			<p class="text-text-muted text-sm font-medium mb-2">Spread</p>
			<p class="text-text-muted text-2xl font-bold">$0.00</p>
			<p class="text-text-muted text-sm mt-1">--</p>
		</div>
		<div class="bg-surface-dark border border-border-dark rounded-xl p-5">
			<p class="text-text-muted text-sm font-medium mb-2">Delta</p>
			<p class="text-text-muted text-2xl font-bold">$0.00</p>
			<p class="text-text-muted text-sm mt-1">--</p>
		</div>
		<div class="bg-surface-dark border border-border-dark rounded-xl p-5">
			<p class="text-text-muted text-sm font-medium mb-2">Vega</p>
			<p class="text-text-muted text-2xl font-bold">$0.00</p>
			<p class="text-text-muted text-sm mt-1">--</p>
		</div>
	</div>

	<!-- Attribution Waterfall - Empty State -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<div class="bg-surface-dark border border-border-dark rounded-xl p-6">
			<h3 class="text-white font-bold mb-6">Attribution Waterfall</h3>
			<div class="flex items-end justify-between h-48 px-4">
				<div class="flex flex-col items-center gap-2">
					<div class="w-16 bg-slate-700/50 rounded-t h-[2%]"></div>
					<span class="text-xs text-text-muted">Open</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<div class="w-16 bg-slate-700/50 rounded-t h-[2%]"></div>
					<span class="text-xs text-text-muted">Delta</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<div class="w-16 bg-slate-700/50 rounded-t h-[2%]"></div>
					<span class="text-xs text-text-muted">Theta</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<div class="w-16 bg-slate-700/50 rounded-t h-[2%]"></div>
					<span class="text-xs text-text-muted">Edge</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<div class="w-16 bg-slate-700/50 rounded-t h-[2%]"></div>
					<span class="text-xs text-text-muted">Vega</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<div class="w-16 bg-slate-700/50 rounded-t h-[2%]"></div>
					<span class="text-xs text-text-muted">Close</span>
				</div>
			</div>
			<p class="text-center text-text-muted text-xs mt-4">No P&L data available</p>
		</div>

		<div class="bg-surface-dark border border-border-dark rounded-xl p-6">
			<h3 class="text-white font-bold mb-6">Cumulative P&L (Intraday)</h3>
			<div class="h-48 flex items-center justify-center">
				<div class="text-center">
					<span class="material-symbols-outlined text-4xl text-text-muted/30 mb-2">show_chart</span>
					<p class="text-text-muted text-sm">No trading activity today</p>
				</div>
			</div>
			<div class="flex justify-between mt-2 text-xs text-text-muted px-4">
				<span>09:30</span>
				<span>12:00</span>
				<span>14:00</span>
				<span>16:00</span>
			</div>
		</div>
	</div>

	<!-- Strategy Breakdown -->
	<div class="bg-surface-dark border border-border-dark rounded-xl overflow-hidden">
		<div class="p-4 border-b border-border-dark">
			<h3 class="text-white font-bold">Strategy Attribution Breakdown</h3>
		</div>
		<div class="overflow-x-auto">
			<table class="w-full text-left border-collapse">
				<thead class="bg-[#151b26] text-xs uppercase text-text-muted font-semibold tracking-wider">
					<tr>
						<th class="px-4 py-3 border-b border-border-dark">Strategy</th>
						<th class="px-4 py-3 border-b border-border-dark">Symbol</th>
						<th class="px-4 py-3 border-b border-border-dark text-right">Total P&L</th>
						<th class="px-4 py-3 border-b border-border-dark text-right">Realized</th>
						<th class="px-4 py-3 border-b border-border-dark text-right">Unrealized</th>
						<th class="px-4 py-3 border-b border-border-dark text-right">Theta</th>
						<th class="px-4 py-3 border-b border-border-dark text-right">Vega</th>
						<th class="px-4 py-3 border-b border-border-dark text-right">Delta</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border-dark text-sm">
					{#each strategies as s}
						<tr class="hover:bg-white/5 transition-colors">
							<td class="px-4 py-3 font-bold text-white">{s.strategy}</td>
							<td class="px-4 py-3 text-text-muted">{s.symbol}</td>
							<td class="px-4 py-3 text-right font-bold tabular-nums {s.totalPnl > 0 ? 'text-success' : 'text-danger'}">{s.totalPnl > 0 ? '+' : ''}${s.totalPnl.toLocaleString()}</td>
							<td class="px-4 py-3 text-right tabular-nums text-text-muted">{s.realized > 0 ? '+' : ''}${s.realized.toLocaleString()}</td>
							<td class="px-4 py-3 text-right tabular-nums {s.unrealized > 0 ? 'text-success' : 'text-danger'}">{s.unrealized > 0 ? '+' : ''}${s.unrealized.toLocaleString()}</td>
							<td class="px-4 py-3 text-right tabular-nums {s.theta > 0 ? 'text-success' : 'text-danger'}">{s.theta > 0 ? '+' : ''}{s.theta.toLocaleString()}</td>
							<td class="px-4 py-3 text-right tabular-nums {s.vega > 0 ? 'text-success' : 'text-danger'}">{s.vega > 0 ? '+' : ''}{s.vega.toLocaleString()}</td>
							<td class="px-4 py-3 text-right tabular-nums {s.delta > 0 ? 'text-success' : 'text-danger'}">{s.delta > 0 ? '+' : ''}{s.delta}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
