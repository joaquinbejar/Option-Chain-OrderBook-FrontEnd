<script lang="ts">
	import { systemStore } from '$lib/stores/system';
	import { controlsStore } from '$lib/stores/controls';

	function handleKillSwitch() {
		controlsStore.toggleMasterSwitch();
	}
</script>

<header
	class="h-16 flex items-center justify-between px-6 border-b border-border-dark bg-[#111722] shrink-0 z-10"
>
	<div class="flex items-center gap-6">
		<!-- System Status -->
		<div class="flex items-center gap-3">
			<div
				class="flex items-center gap-2 px-3 py-1.5 rounded-full {$systemStore.connected
					? 'bg-success/10'
					: 'bg-danger/10'}"
			>
				<span class="relative flex h-2 w-2">
					{#if $systemStore.connected}
						<span
							class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"
						></span>
					{/if}
					<span
						class="relative inline-flex rounded-full h-2 w-2 {$systemStore.connected
							? 'bg-success'
							: 'bg-danger'}"
					></span>
				</span>
				<span
					class="text-xs font-bold uppercase tracking-wider {$systemStore.connected
						? 'text-success'
						: 'text-danger'}"
				>
					{$systemStore.connected ? 'Connected' : 'Disconnected'}
				</span>
			</div>
			<div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-dark">
				<span class="material-symbols-outlined text-primary text-sm">speed</span>
				<span class="text-xs text-white font-mono">{$systemStore.latency}ms</span>
			</div>
		</div>
	</div>
	<div class="flex items-center gap-3">
		<!-- Kill Switch -->
		<button
			onclick={handleKillSwitch}
			class="flex items-center gap-2 h-9 px-4 text-white text-sm font-bold rounded-lg transition-colors shadow-lg {$controlsStore.masterSwitch
				? 'bg-danger hover:bg-red-600 shadow-red-900/20'
				: 'bg-success hover:bg-green-600 shadow-green-900/20'}"
		>
			<span class="material-symbols-outlined text-[18px]">power_settings_new</span>
			<span class="hidden sm:inline"
				>{$controlsStore.masterSwitch ? 'Kill Switch' : 'Activate Quoting'}</span
			>
		</button>
		<div class="h-6 w-px bg-border-dark mx-1"></div>
		<button
			class="w-9 h-9 flex items-center justify-center rounded-lg bg-[#232f48] text-white hover:bg-primary hover:text-white transition-colors"
		>
			<span class="material-symbols-outlined text-[20px]">notifications</span>
		</button>
	</div>
</header>
