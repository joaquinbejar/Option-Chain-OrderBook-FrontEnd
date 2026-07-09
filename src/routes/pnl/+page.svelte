<script lang="ts">
	interface Strategy {
		strategy: string;
		symbol: string;
		totalPnl: number;
		realized: number;
		unrealized: number;
		theta: number;
		vega: number;
		delta: number;
	}

	// The backend does not expose P&L attribution yet — this list stays empty
	// (honest empty state below) until a P&L endpoint exists.
	const strategies: Strategy[] = [];
</script>

<div class="p-6 max-w-[1400px] mx-auto flex flex-col gap-6">
	<!-- Header -->
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-white text-2xl sm:text-3xl font-bold leading-tight">P&L Decomposition</h1>
			<p class="text-text-muted text-sm">
				Understand where P&L is coming from: theta, delta, vega, spread capture.
			</p>
		</div>
	</div>

	<!-- Summary Cards - the backend exposes no P&L surface yet -->
	<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
		{#each ['Total P&L', 'Theta', 'Spread', 'Delta', 'Vega'] as metric (metric)}
			<div class="bg-surface-dark border border-border-dark rounded-xl p-5">
				<p class="text-text-muted text-sm font-medium mb-2">{metric}</p>
				<p class="text-text-muted text-2xl font-bold">—</p>
				<p class="text-text-muted text-xs mt-1">Not provided by the backend</p>
			</div>
		{/each}
	</div>

	<!-- Attribution Waterfall - Empty State -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<div class="bg-surface-dark border border-border-dark rounded-xl p-6">
			<h3 class="text-white font-bold mb-6">Attribution Waterfall</h3>
			<div class="h-48 flex items-center justify-center">
				<div class="text-center">
					<span
						class="material-symbols-outlined text-4xl text-text-muted/30 mb-2"
						aria-hidden="true">waterfall_chart</span
					>
					<p class="text-text-muted text-sm">P&L attribution is not exposed by the backend yet.</p>
				</div>
			</div>
		</div>

		<div class="bg-surface-dark border border-border-dark rounded-xl p-6">
			<h3 class="text-white font-bold mb-6">Cumulative P&L (Intraday)</h3>
			<div class="h-48 flex items-center justify-center">
				<div class="text-center">
					<span
						class="material-symbols-outlined text-4xl text-text-muted/30 mb-2"
						aria-hidden="true">show_chart</span
					>
					<p class="text-text-muted text-sm">Cumulative P&L is not exposed by the backend yet.</p>
				</div>
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
					{#each strategies as s (s.strategy)}
						<tr class="hover:bg-white/5 transition-colors">
							<td class="px-4 py-3 font-bold text-white">{s.strategy}</td>
							<td class="px-4 py-3 text-text-muted">{s.symbol}</td>
							<td
								class="px-4 py-3 text-right font-bold tabular-nums {s.totalPnl > 0
									? 'text-success'
									: 'text-danger'}">{s.totalPnl > 0 ? '+' : ''}${s.totalPnl.toLocaleString()}</td
							>
							<td class="px-4 py-3 text-right tabular-nums text-text-muted"
								>{s.realized > 0 ? '+' : ''}${s.realized.toLocaleString()}</td
							>
							<td
								class="px-4 py-3 text-right tabular-nums {s.unrealized > 0
									? 'text-success'
									: 'text-danger'}"
								>{s.unrealized > 0 ? '+' : ''}${s.unrealized.toLocaleString()}</td
							>
							<td
								class="px-4 py-3 text-right tabular-nums {s.theta > 0
									? 'text-success'
									: 'text-danger'}">{s.theta > 0 ? '+' : ''}{s.theta.toLocaleString()}</td
							>
							<td
								class="px-4 py-3 text-right tabular-nums {s.vega > 0
									? 'text-success'
									: 'text-danger'}">{s.vega > 0 ? '+' : ''}{s.vega.toLocaleString()}</td
							>
							<td
								class="px-4 py-3 text-right tabular-nums {s.delta > 0
									? 'text-success'
									: 'text-danger'}">{s.delta > 0 ? '+' : ''}{s.delta}</td
							>
						</tr>
					{:else}
						<tr>
							<td colspan="8" class="px-4 py-10 text-center text-text-muted text-sm">
								The backend does not expose per-strategy P&L yet.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
