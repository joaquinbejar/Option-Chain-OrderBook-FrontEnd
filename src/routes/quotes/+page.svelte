<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api/client';

	let underlyings: string[] = [];
	let expirations: string[] = [];
	let selectedUnderlying = '';
	let selectedExpiration = '';
	let loading = true;

	onMount(async () => {
		try {
			const result = await api.listUnderlyings();
			underlyings = result.underlyings;
			if (underlyings.length > 0) {
				selectedUnderlying = underlyings[0];
				await loadExpirations();
			}
		} catch (e) {
			console.error('Failed to load underlyings:', e);
		} finally {
			loading = false;
		}
	});

	async function loadExpirations() {
		if (!selectedUnderlying) return;
		try {
			const resp = await api.listExpirations(selectedUnderlying);
			expirations = resp.expirations;
			if (expirations.length > 0) {
				selectedExpiration = expirations[0];
			}
		} catch (e) {
			console.error('Failed to load expirations:', e);
		}
	}

	async function handleUnderlyingChange() {
		await loadExpirations();
	}
</script>

<div class="p-6 flex flex-col gap-6 max-w-[1600px] mx-auto">
	<!-- Stats Row - Empty State -->
	<section class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
		<div class="bg-surface-dark border border-border-dark rounded-lg p-4 flex flex-col justify-between h-28 relative overflow-hidden group">
			<p class="text-text-muted text-sm font-medium">Delta Exposure</p>
			<div>
				<p class="text-text-muted text-2xl font-bold tracking-tight">--</p>
				<p class="text-text-muted text-sm font-medium mt-1">No quotes</p>
			</div>
		</div>
		<div class="bg-surface-dark border border-border-dark rounded-lg p-4 flex flex-col justify-between h-28">
			<p class="text-text-muted text-sm font-medium">Gamma</p>
			<div>
				<p class="text-text-muted text-2xl font-bold tracking-tight">--</p>
				<p class="text-text-muted text-sm font-medium mt-1">No quotes</p>
			</div>
		</div>
		<div class="bg-surface-dark border border-border-dark rounded-lg p-4 flex flex-col justify-between h-28">
			<p class="text-text-muted text-sm font-medium">Theta (Decay)</p>
			<div>
				<p class="text-text-muted text-2xl font-bold tracking-tight">--</p>
				<p class="text-text-muted text-sm font-medium mt-1">No quotes</p>
			</div>
		</div>
		<div class="bg-surface-dark border border-border-dark rounded-lg p-4 flex flex-col justify-between h-28">
			<p class="text-text-muted text-sm font-medium">Vega</p>
			<div>
				<p class="text-text-muted text-2xl font-bold tracking-tight">--</p>
				<p class="text-text-muted text-sm font-medium mt-1">No quotes</p>
			</div>
		</div>
		<div class="bg-surface-dark border border-border-dark rounded-lg p-4 flex flex-col justify-between h-28 relative overflow-hidden">
			<p class="text-text-muted text-sm font-medium">Daily P&L</p>
			<div>
				<p class="text-text-muted text-2xl font-bold tracking-tight">$0.00</p>
				<p class="text-text-muted text-sm font-medium mt-1">No activity</p>
			</div>
		</div>
	</section>

	<!-- Quote Matrix -->
	<div class="flex flex-col bg-surface-dark border border-border-dark rounded-lg overflow-hidden shadow-sm">
		<div class="p-4 border-b border-border-dark flex items-center justify-between bg-[#151b26]">
			<h3 class="text-white font-bold flex items-center gap-2">
				<span class="material-symbols-outlined text-primary">view_column</span>
				Quote Matrix - {selectedUnderlying || 'Select Underlying'}
			</h3>
			<div class="flex gap-4 items-center">
				<select 
					bind:value={selectedUnderlying}
					on:change={handleUnderlyingChange}
					class="bg-background-dark border border-border-dark text-white text-sm rounded-lg p-2 font-medium focus:ring-primary focus:border-primary"
				>
					{#each underlyings as underlying}
						<option value={underlying}>{underlying}</option>
					{/each}
				</select>
				<select 
					bind:value={selectedExpiration}
					class="bg-background-dark border border-border-dark text-white text-sm rounded-lg p-2 font-medium focus:ring-primary focus:border-primary"
				>
					{#each expirations as exp}
						<option value={exp}>{exp}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Table Header -->
		<div class="grid grid-cols-9 gap-0 text-xs font-semibold text-text-muted border-b border-border-dark bg-[#1a2230] py-2">
			<div class="col-span-4 grid grid-cols-4 text-center">
				<div>Bid Size</div>
				<div>Bid</div>
				<div>Ask</div>
				<div>Ask Size</div>
			</div>
			<div class="col-span-1 text-center border-x border-border-dark text-white">Strike</div>
			<div class="col-span-4 grid grid-cols-4 text-center">
				<div>Bid Size</div>
				<div>Bid</div>
				<div>Ask</div>
				<div>Ask Size</div>
			</div>
		</div>

		<!-- Empty State -->
		<div class="flex flex-col items-center justify-center py-16 px-4">
			<span class="material-symbols-outlined text-6xl text-text-muted/30 mb-4">format_quote</span>
			<h4 class="text-white text-lg font-bold mb-2">No Quotes Available</h4>
			<p class="text-text-muted text-sm text-center max-w-md">
				The market maker is not currently quoting. Enable quoting in the Controls page to start generating quotes for the selected underlying and expiration.
			</p>
			<a href="/controls" class="mt-6 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors">
				Go to Controls
			</a>
		</div>
	</div>
</div>
