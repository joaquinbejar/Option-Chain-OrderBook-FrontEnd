<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Header from '$lib/components/Header.svelte';
	import AuthGate from '$lib/components/AuthGate.svelte';
	import { systemStore } from '$lib/stores/system';
	import { controlsStore } from '$lib/stores/controls';
	import { authStore, isAuthenticated } from '$lib/stores/auth';

	let { children } = $props();

	onMount(() => {
		authStore.init();
		return () => {
			systemStore.disconnect();
			controlsStore.disconnect();
			authStore.disconnect();
		};
	});

	// The app-shell stores start only once authenticated (unauthenticated REST
	// calls would just 401) and stop when the session ends.
	$effect(() => {
		if ($isAuthenticated) {
			systemStore.init();
			controlsStore.init();
		} else {
			systemStore.disconnect();
			controlsStore.disconnect();
		}
	});
</script>

<div class="flex h-screen overflow-hidden">
	<Sidebar />
	<div class="flex-1 flex flex-col min-w-0 overflow-hidden">
		<Header />
		{#if $isAuthenticated}
			<main class="flex-1 overflow-y-auto overflow-x-hidden bg-[#0f1218]">
				{@render children()}
			</main>
		{:else}
			<AuthGate />
		{/if}
	</div>
</div>
