<script lang="ts">
	interface Position {
		symbol: string;
		name: string;
		qty: number;
		markPrice: number;
		delta: number;
		gamma: number;
		vega: number;
		theta: number;
		pnl: number;
	}

	// The backend does not expose portfolio positions yet — this list stays
	// empty (honest empty state below) until a positions endpoint exists.
	const positions: Position[] = [];
</script>

<div class="p-4 grid grid-cols-12 grid-rows-[auto_1fr] gap-4 h-full overflow-hidden">
	<!-- KPI Cards Row - Empty State -->
	<div class="col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-auto">
		<div
			class="flex flex-col justify-between rounded-xl p-4 border border-border-dark bg-surface-dark shadow-sm"
		>
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-xs font-bold uppercase tracking-wider">Margin Utilization</p>
				<span class="material-symbols-outlined text-text-muted text-sm">pie_chart</span>
			</div>
			<div class="flex items-end justify-between">
				<p class="text-text-muted text-2xl font-bold tabular-nums">—</p>
				<span class="text-xs text-text-muted">Not provided by the backend</span>
			</div>
		</div>
		<div
			class="flex flex-col justify-between rounded-xl p-4 border border-border-dark bg-surface-dark shadow-sm"
		>
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-xs font-bold uppercase tracking-wider">
					Net Portfolio Delta
				</p>
				<span class="material-symbols-outlined text-text-muted text-sm">balance</span>
			</div>
			<div class="flex items-end justify-between">
				<p class="text-text-muted text-2xl font-bold tabular-nums">—</p>
				<span class="text-xs text-text-muted">Not provided by the backend</span>
			</div>
		</div>
		<div
			class="flex flex-col justify-between rounded-xl p-4 border border-border-dark bg-surface-dark shadow-sm"
		>
			<div class="flex justify-between items-start mb-2">
				<p class="text-text-muted text-xs font-bold uppercase tracking-wider">
					Total Vega Exposure
				</p>
				<span class="material-symbols-outlined text-text-muted text-sm">show_chart</span>
			</div>
			<div class="flex items-end justify-between">
				<p class="text-text-muted text-2xl font-bold tabular-nums">—</p>
				<span class="text-xs text-text-muted">Not provided by the backend</span>
			</div>
		</div>
		<div
			class="flex flex-col justify-between rounded-xl p-4 border border-border-dark bg-surface-dark shadow-sm relative overflow-hidden"
		>
			<div class="flex justify-between items-start mb-2 relative z-10">
				<p class="text-text-muted text-xs font-bold uppercase tracking-wider">
					Active Limits Breached
				</p>
				<span class="material-symbols-outlined text-text-muted text-sm">rule</span>
			</div>
			<div class="flex items-end justify-between relative z-10">
				<p class="text-text-muted text-2xl font-bold tabular-nums">—</p>
				<span class="text-xs text-text-muted">Not provided by the backend</span>
			</div>
		</div>
	</div>

	<!-- Inventory Table -->
	<div
		class="col-span-12 lg:col-span-8 flex flex-col min-h-0 bg-surface-dark rounded-xl border border-border-dark shadow-sm"
	>
		<div class="flex items-center justify-between p-4 border-b border-border-dark">
			<div class="flex items-center gap-2">
				<h3 class="text-white font-bold text-lg">Inventory & Risk Matrix</h3>
			</div>
			<div class="flex gap-2">
				<div class="relative">
					<span
						class="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-text-muted text-[18px]"
						aria-hidden="true">search</span
					>
					<input
						disabled
						aria-label="Filter ticker"
						class="h-8 pl-9 pr-3 rounded bg-background-dark border border-border-dark text-xs w-40 text-white focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
						placeholder="Filter (no positions)"
						type="text"
					/>
				</div>
			</div>
		</div>
		<div class="flex-1 overflow-auto">
			<table class="w-full text-left border-collapse">
				<thead
					class="sticky top-0 z-10 bg-[#151c2a] text-xs uppercase text-text-muted font-semibold tracking-wider"
				>
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
					{#each positions as pos (pos.symbol)}
						<tr
							class="hover:bg-white/5 transition-colors group {pos.delta < -100
								? 'border-l-2 border-l-danger bg-danger/5'
								: pos.delta < 0
									? 'border-l-2 border-l-warning'
									: ''}"
						>
							<td class="px-4 py-3">
								<div class="flex flex-col">
									<span class="text-white font-bold">{pos.symbol}</span>
									<span class="text-[10px] text-text-muted">{pos.name}</span>
								</div>
							</td>
							<td
								class="px-4 py-3 text-right tabular-nums {pos.qty < 0
									? 'text-danger'
									: 'text-success'}">{pos.qty.toLocaleString()}</td
							>
							<td class="px-4 py-3 text-right tabular-nums">{pos.markPrice.toFixed(2)}</td>
							<td
								class="px-4 py-3 text-right tabular-nums font-bold {pos.delta > 0
									? 'text-success bg-success/5'
									: pos.delta < 0
										? 'text-danger bg-danger/5'
										: 'text-text-muted'}">{pos.delta > 0 ? '+' : ''}{pos.delta.toFixed(1)}</td
							>
							<td
								class="px-4 py-3 text-right tabular-nums {pos.gamma > 0
									? 'text-success'
									: 'text-danger'}">{pos.gamma > 0 ? '+' : ''}{pos.gamma.toFixed(1)}</td
							>
							<td
								class="px-4 py-3 text-right tabular-nums {pos.vega > 0
									? 'text-success'
									: 'text-danger'}">{pos.vega.toFixed(1)}</td
							>
							<td
								class="px-4 py-3 text-right tabular-nums {pos.theta > 0
									? 'text-success'
									: 'text-danger'}">{pos.theta > 0 ? '+' : ''}{pos.theta.toFixed(1)}</td
							>
							<td
								class="px-4 py-3 text-right tabular-nums font-bold {pos.pnl > 0
									? 'text-success'
									: 'text-danger'}">{pos.pnl > 0 ? '+' : ''}${pos.pnl.toLocaleString()}</td
							>
						</tr>
					{:else}
						<tr>
							<td colspan="8" class="px-4 py-10 text-center text-text-muted text-sm">
								The backend does not expose portfolio positions yet.
							</td>
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
				<span class="text-xs text-text-muted uppercase font-bold tracking-wider">Not wired</span>
			</div>
			<div class="bg-background-dark rounded-lg p-4 mb-4 border border-border-dark">
				<p class="text-sm text-text-muted">
					Auto-hedging status, net exposure and required actions are not exposed by the backend yet.
					Nothing shown here would be real — this panel activates when the backend provides a
					hedging surface.
				</p>
			</div>
			<button
				disabled
				class="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-border-dark text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<span class="material-symbols-outlined text-[18px]">tune</span>
				Adjust Hedge Parameters
				<span class="text-xs text-text-muted font-normal">(not wired)</span>
			</button>
		</div>

		<!-- P&L Decomposition Mini -->
		<div class="bg-surface-dark rounded-xl border border-border-dark p-5 shadow-sm flex-none">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-white font-bold">P&L Decomposition</h3>
				<span class="material-symbols-outlined text-text-muted text-sm">bar_chart</span>
			</div>
			<div class="h-32 flex items-center justify-center text-center">
				<p class="text-text-muted text-sm px-4">
					P&L attribution is not exposed by the backend yet.
				</p>
			</div>
		</div>
	</div>
</div>
