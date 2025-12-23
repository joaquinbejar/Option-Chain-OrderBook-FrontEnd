<script lang="ts">
	const positions = [
		{ symbol: 'SPY', name: 'S&P 500 ETF', qty: -250, markPrice: 445.20, delta: 120.5, gamma: -45.2, vega: -200.0, theta: 350.1, pnl: 2100 },
		{ symbol: 'QQQ', name: 'Nasdaq 100', qty: 100, markPrice: 372.50, delta: -30.4, gamma: 15.8, vega: 50.2, theta: -120.5, pnl: -450 },
		{ symbol: 'IWM', name: 'Russell 2000', qty: 500, markPrice: 185.10, delta: 0.0, gamma: 2.1, vega: -12.5, theta: 45.0, pnl: 850 },
		{ symbol: 'AAPL', name: 'Apple Inc.', qty: -1200, markPrice: 178.35, delta: 85.4, gamma: 55.2, vega: -400.1, theta: 600.5, pnl: 5320 },
		{ symbol: 'TSLA', name: 'Tesla Inc.', qty: -50, markPrice: 245.60, delta: -210.5, gamma: -85.2, vega: 120.0, theta: -50.1, pnl: -1240 }
	];
</script>

<div class="p-4 grid grid-cols-12 grid-rows-[auto_1fr] gap-4 h-full overflow-hidden">
	<!-- KPI Cards Row -->
	<div class="col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-auto">
		<div class="flex flex-col justify-between rounded-xl p-4 border border-border-dark bg-surface-dark shadow-sm">
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-xs font-bold uppercase tracking-wider">Margin Utilization</p>
				<span class="material-symbols-outlined text-text-muted text-sm">pie_chart</span>
			</div>
			<div class="flex items-end justify-between">
				<p class="text-white text-2xl font-bold tabular-nums">42%</p>
				<div class="h-1.5 w-24 bg-slate-700 rounded-full overflow-hidden">
					<div class="h-full bg-primary w-[42%]"></div>
				</div>
			</div>
		</div>
		<div class="flex flex-col justify-between rounded-xl p-4 border border-border-dark bg-surface-dark shadow-sm">
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-xs font-bold uppercase tracking-wider">Net Portfolio Delta</p>
				<span class="material-symbols-outlined text-text-muted text-sm">balance</span>
			</div>
			<div class="flex items-end justify-between">
				<p class="text-white text-2xl font-bold tabular-nums">+450.20</p>
				<span class="text-xs font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded">High Exp.</span>
			</div>
		</div>
		<div class="flex flex-col justify-between rounded-xl p-4 border border-border-dark bg-surface-dark shadow-sm">
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-xs font-bold uppercase tracking-wider">Total Vega Exposure</p>
				<span class="material-symbols-outlined text-text-muted text-sm">show_chart</span>
			</div>
			<div class="flex items-end justify-between">
				<p class="text-white text-2xl font-bold tabular-nums">-1,240</p>
				<span class="text-xs text-success flex items-center">
					<span class="material-symbols-outlined text-[14px] mr-0.5">trending_down</span>
					2.4%
				</span>
			</div>
		</div>
		<div class="flex flex-col justify-between rounded-xl p-4 border border-danger/30 bg-danger/5 shadow-sm relative overflow-hidden">
			<div class="absolute right-0 top-0 p-4 opacity-10">
				<span class="material-symbols-outlined text-6xl text-danger">warning</span>
			</div>
			<div class="flex justify-between items-start mb-2 relative z-10">
				<p class="text-danger text-xs font-bold uppercase tracking-wider">Active Limits Breached</p>
				<span class="animate-pulse h-2 w-2 rounded-full bg-danger"></span>
			</div>
			<div class="flex items-end justify-between relative z-10">
				<p class="text-white text-2xl font-bold tabular-nums">2</p>
				<button class="text-xs font-bold text-white bg-danger hover:bg-red-600 px-2 py-1 rounded transition-colors">View Alerts</button>
			</div>
		</div>
	</div>

	<!-- Inventory Table -->
	<div class="col-span-12 lg:col-span-8 flex flex-col min-h-0 bg-surface-dark rounded-xl border border-border-dark shadow-sm">
		<div class="flex items-center justify-between p-4 border-b border-border-dark">
			<div class="flex items-center gap-2">
				<h3 class="text-white font-bold text-lg">Inventory & Risk Matrix</h3>
				<span class="px-2 py-0.5 rounded-full bg-slate-700 text-xs text-slate-300 font-medium">Live</span>
			</div>
			<div class="flex gap-2">
				<div class="relative">
					<span class="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-text-muted text-[18px]">search</span>
					<input class="h-8 pl-9 pr-3 rounded bg-background-dark border border-border-dark text-xs w-40 text-white focus:outline-none focus:border-primary" placeholder="Filter ticker..." type="text" />
				</div>
			</div>
		</div>
		<div class="flex-1 overflow-auto">
			<table class="w-full text-left border-collapse">
				<thead class="sticky top-0 z-10 bg-[#151c2a] text-xs uppercase text-text-muted font-semibold tracking-wider">
					<tr>
						<th class="px-4 py-3 border-b border-border-dark">Underlying</th>
						<th class="px-4 py-3 border-b border-border-dark text-right">Net Qty</th>
						<th class="px-4 py-3 border-b border-border-dark text-right">Mark Price</th>
						<th class="px-4 py-3 border-b border-border-dark text-right">Tot. Delta</th>
						<th class="px-4 py-3 border-b border-border-dark text-right">Tot. Gamma</th>
						<th class="px-4 py-3 border-b border-border-dark text-right">Tot. Vega</th>
						<th class="px-4 py-3 border-b border-border-dark text-right">Tot. Theta</th>
						<th class="px-4 py-3 border-b border-border-dark text-right">Day P&L</th>
					</tr>
				</thead>
				<tbody class="text-sm font-medium divide-y divide-border-dark text-slate-300">
					{#each positions as pos}
						<tr class="hover:bg-white/5 transition-colors group {pos.delta < -100 ? 'border-l-2 border-l-danger bg-danger/5' : pos.delta < 0 ? 'border-l-2 border-l-warning' : ''}">
							<td class="px-4 py-3">
								<div class="flex flex-col">
									<span class="text-white font-bold">{pos.symbol}</span>
									<span class="text-[10px] text-text-muted">{pos.name}</span>
								</div>
							</td>
							<td class="px-4 py-3 text-right tabular-nums {pos.qty < 0 ? 'text-danger' : 'text-success'}">{pos.qty.toLocaleString()}</td>
							<td class="px-4 py-3 text-right tabular-nums">{pos.markPrice.toFixed(2)}</td>
							<td class="px-4 py-3 text-right tabular-nums font-bold {pos.delta > 0 ? 'text-success bg-success/5' : pos.delta < 0 ? 'text-danger bg-danger/5' : 'text-text-muted'}">{pos.delta > 0 ? '+' : ''}{pos.delta.toFixed(1)}</td>
							<td class="px-4 py-3 text-right tabular-nums {pos.gamma > 0 ? 'text-success' : 'text-danger'}">{pos.gamma > 0 ? '+' : ''}{pos.gamma.toFixed(1)}</td>
							<td class="px-4 py-3 text-right tabular-nums {pos.vega > 0 ? 'text-success' : 'text-danger'}">{pos.vega.toFixed(1)}</td>
							<td class="px-4 py-3 text-right tabular-nums {pos.theta > 0 ? 'text-success' : 'text-danger'}">{pos.theta > 0 ? '+' : ''}{pos.theta.toFixed(1)}</td>
							<td class="px-4 py-3 text-right tabular-nums font-bold {pos.pnl > 0 ? 'text-success' : 'text-danger'}">{pos.pnl > 0 ? '+' : ''}${pos.pnl.toLocaleString()}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Right Panel -->
	<div class="col-span-12 lg:col-span-4 flex flex-col gap-4 min-h-0">
		<!-- Delta Hedging -->
		<div class="bg-surface-dark rounded-xl border border-border-dark p-5 shadow-sm flex-none">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-white font-bold">Delta Hedging</h3>
				<div class="flex items-center gap-1.5">
					<span class="h-2 w-2 rounded-full bg-success animate-pulse"></span>
					<span class="text-xs text-text-muted uppercase font-bold tracking-wider">Auto-Hedge On</span>
				</div>
			</div>
			<div class="bg-background-dark rounded-lg p-4 mb-4 border border-border-dark">
				<div class="flex justify-between items-center mb-2">
					<span class="text-sm text-text-muted font-medium">Net Exposure</span>
					<span class="text-sm text-white font-bold tabular-nums">+450.20 Delta</span>
				</div>
				<div class="flex justify-between items-center mb-3">
					<span class="text-sm text-text-muted font-medium">Required Action</span>
					<span class="text-sm text-danger font-bold">SHORT 450 SPY</span>
				</div>
				<div class="relative h-2 bg-border-dark rounded-full overflow-hidden mb-1">
					<div class="absolute top-0 left-0 h-full w-[65%] bg-primary rounded-full"></div>
				</div>
				<div class="flex justify-between text-[10px] text-text-muted">
					<span>Fills: 290/450</span>
					<span>Working...</span>
				</div>
			</div>
			<button class="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-border-dark hover:bg-slate-600 text-white text-sm font-bold transition-colors">
				<span class="material-symbols-outlined text-[18px]">tune</span>
				Adjust Hedge Parameters
			</button>
		</div>

		<!-- P&L Decomposition Mini -->
		<div class="bg-surface-dark rounded-xl border border-border-dark p-5 shadow-sm flex-none">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-white font-bold">P&L Decomposition</h3>
				<span class="material-symbols-outlined text-text-muted text-sm">bar_chart</span>
			</div>
			<div class="flex h-32 gap-3 items-end justify-between px-2">
				<div class="flex flex-col items-center gap-1 w-full">
					<div class="w-full bg-success/80 rounded-t h-[80%] hover:bg-success transition-colors"></div>
					<span class="text-[10px] text-text-muted font-medium">Theta</span>
				</div>
				<div class="flex flex-col items-center gap-1 w-full">
					<div class="w-full bg-danger/80 rounded-t h-[30%] hover:bg-danger transition-colors"></div>
					<span class="text-[10px] text-text-muted font-medium">Delta</span>
				</div>
				<div class="flex flex-col items-center gap-1 w-full">
					<div class="w-full bg-success/80 rounded-t h-[45%] hover:bg-success transition-colors"></div>
					<span class="text-[10px] text-text-muted font-medium">Vega</span>
				</div>
				<div class="flex flex-col items-center gap-1 w-full">
					<div class="w-full bg-primary/80 rounded-t h-[60%] hover:bg-primary transition-colors"></div>
					<span class="text-[10px] text-text-muted font-medium">Edge</span>
				</div>
			</div>
		</div>
	</div>
</div>
