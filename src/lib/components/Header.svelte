<script lang="ts">
	import { systemStore } from '$lib/stores/system';
	import { controlsStore } from '$lib/stores/controls';
	import { authStore, isAdmin } from '$lib/stores/auth';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

	let showKillConfirm = $state(false);

	function handleKillSwitch() {
		if (!$isAdmin) return; // controls require an admin token
		if ($controlsStore.masterSwitch) {
			// Halting is destructive (cancels all open orders) — confirm first.
			showKillConfirm = true;
		} else {
			// Resuming quoting stays frictionless.
			controlsStore.resume();
		}
	}

	function confirmKill() {
		showKillConfirm = false;
		controlsStore.halt();
	}

	// If quoting halts while the dialog is open (another client, a backend
	// risk kill) or the session ends, the question is stale — dismiss it.
	$effect(() => {
		if (!$controlsStore.masterSwitch || !$authStore.authenticated) {
			showKillConfirm = false;
		}
	});
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
			<div
				class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-dark"
				title={$systemStore.latencyStale ? 'No recent heartbeat — latency unknown' : 'Latency'}
			>
				<span
					class="material-symbols-outlined text-sm {$systemStore.latencyStale
						? 'text-warning'
						: 'text-primary'}">speed</span
				>
				<span class="text-xs font-mono {$systemStore.latencyStale ? 'text-warning' : 'text-white'}"
					>{$systemStore.latencyStale ? 'stale' : `${$systemStore.latency}ms`}</span
				>
			</div>
		</div>
	</div>
	<div class="flex items-center gap-3">
		{#if $authStore.authenticated}
			<!-- Kill Switch — controls need an admin token -->
			<button
				onclick={handleKillSwitch}
				disabled={!$isAdmin}
				title={$isAdmin ? undefined : 'Requires an admin token'}
				class="flex items-center gap-2 h-9 px-4 text-white text-sm font-bold rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed {$controlsStore.masterSwitch
					? 'bg-danger hover:bg-red-600 shadow-red-900/20'
					: 'bg-success hover:bg-green-600 shadow-green-900/20'}"
			>
				<span class="material-symbols-outlined text-[18px]">power_settings_new</span>
				<span class="hidden sm:inline"
					>{$controlsStore.masterSwitch ? 'Kill Switch' : 'Activate Quoting'}</span
				>
			</button>
			<div class="h-6 w-px bg-border-dark mx-1"></div>
			{#if $authStore.expiringSoon}
				<div
					role="status"
					class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 text-warning"
					title="Re-authenticate before the session drops"
				>
					<span class="material-symbols-outlined text-sm" aria-hidden="true">schedule</span>
					<span class="text-xs font-bold uppercase tracking-wider">Session expiring soon</span>
				</div>
			{/if}
			<div
				class="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-dark"
				title="Token permissions"
			>
				<span class="material-symbols-outlined text-text-muted text-sm" aria-hidden="true"
					>badge</span
				>
				<span class="text-xs text-white font-mono">{$authStore.sub}</span>
				<span class="text-xs text-text-muted font-mono">[{$authStore.permissions.join(', ')}]</span>
			</div>
			<button
				aria-label="Log out"
				title="Log out"
				onclick={() => authStore.logout()}
				class="w-9 h-9 flex items-center justify-center rounded-lg bg-[#232f48] text-white hover:bg-danger transition-colors"
			>
				<span class="material-symbols-outlined text-[20px]">logout</span>
			</button>
		{:else}
			<span class="text-xs text-text-muted uppercase font-bold tracking-wider">
				Not authenticated
			</span>
		{/if}
	</div>
</header>

{#if $authStore.authenticated}
	<ConfirmDialog
		open={showKillConfirm}
		title="Halt all quoting?"
		message="This fires the kill switch: every open order is cancelled immediately and no new quotes are sent until quoting is re-enabled."
		confirmLabel="Halt quoting"
		onconfirm={confirmKill}
		oncancel={() => (showKillConfirm = false)}
	/>
{/if}
