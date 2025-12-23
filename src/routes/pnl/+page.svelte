<script lang="ts">
	const strategies = [
		{ strategy: 'MM_Default', symbol: 'SPXW', totalPnl: 8420, realized: 2100, unrealized: 6320, theta: 2100, vega: 5400, delta: -200 },
		{ strategy: 'Vol_Arb', symbol: 'NDX', totalPnl: 4200, realized: 500, unrealized: 3700, theta: 1200, vega: 2100, delta: 150 },
		{ strategy: 'Gamma_Scalp', symbol: 'SPY', totalPnl: 2800, realized: 1800, unrealized: 1000, theta: -500, vega: 800, delta: 2500 },
		{ strategy: 'Theta_Harvest', symbol: 'QQQ', totalPnl: -450, realized: 200, unrealized: -650, theta: 1500, vega: -1200, delta: -750 }
	];
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

	<!-- Summary Cards -->
	<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
		<div class="bg-surface-dark border border-primary/30 rounded-xl p-5 relative overflow-hidden">
			<div class="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none"></div>
			<p class="text-text-muted text-sm font-medium mb-2">Total P&L</p>
			<p class="text-white text-3xl font-bold">+$15,420</p>
			<p class="text-success text-sm mt-1">+2.4%</p>
		</div>
		<div class="bg-surface-dark border border-border-dark rounded-xl p-5">
			<p class="text-text-muted text-sm font-medium mb-2">Theta</p>
			<p class="text-white text-2xl font-bold">+$4,200</p>
			<p class="text-success text-sm mt-1">+0.8%</p>
		</div>
		<div class="bg-surface-dark border border-border-dark rounded-xl p-5">
			<p class="text-text-muted text-sm font-medium mb-2">Spread</p>
			<p class="text-white text-2xl font-bold">+$2,100</p>
			<p class="text-success text-sm mt-1">+1.2%</p>
		</div>
		<div class="bg-surface-dark border border-border-dark rounded-xl p-5">
			<p class="text-text-muted text-sm font-medium mb-2">Delta</p>
			<p class="text-white text-2xl font-bold">-$500</p>
			<p class="text-danger text-sm mt-1">-0.1%</p>
		</div>
		<div class="bg-surface-dark border border-border-dark rounded-xl p-5">
			<p class="text-text-muted text-sm font-medium mb-2">Vega</p>
			<p class="text-white text-2xl font-bold">+$8,000</p>
			<p class="text-success text-sm mt-1">+3.5%</p>
		</div>
	</div>

	<!-- Attribution Waterfall -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<div class="bg-surface-dark border border-border-dark rounded-xl p-6">
			<h3 class="text-white font-bold mb-6">Attribution Waterfall</h3>
			<div class="flex items-end justify-between h-48 px-4">
				<div class="flex flex-col items-center gap-2">
					<div class="w-16 bg-slate-600 rounded-t h-[60%]"></div>
					<span class="text-xs text-text-muted">Open</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<div class="w-16 bg-danger/80 rounded-t h-[15%]"></div>
					<span class="text-xs text-text-muted">Delta</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<div class="w-16 bg-success/80 rounded-t h-[30%]"></div>
					<span class="text-xs text-text-muted">Theta</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<div class="w-16 bg-success/80 rounded-t h-[20%]"></div>
					<span class="text-xs text-text-muted">Edge</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<div class="w-16 bg-success/80 rounded-t h-[45%]"></div>
					<span class="text-xs text-text-muted">Vega</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<div class="w-16 bg-primary rounded-t h-[85%]"></div>
					<span class="text-xs text-text-muted">Close</span>
				</div>
			</div>
		</div>

		<div class="bg-surface-dark border border-border-dark rounded-xl p-6">
			<h3 class="text-white font-bold mb-6">Cumulative P&L (Intraday)</h3>
			<div class="h-48 flex items-end justify-between gap-1 px-4">
				{#each Array(24) as _, i}
					<div class="flex-1 bg-primary/60 rounded-t hover:bg-primary transition-colors" style="height: {20 + Math.sin(i * 0.5) * 30 + i * 2}%"></div>
				{/each}
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
