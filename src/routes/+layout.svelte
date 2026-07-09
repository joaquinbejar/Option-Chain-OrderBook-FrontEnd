<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Header from '$lib/components/Header.svelte';
	import { systemStore } from '$lib/stores/system';
	import { controlsStore } from '$lib/stores/controls';

	let { children } = $props();

	// The app shell owns the system and controls store lifecycles: the Header
	// (kill switch, connection pill) needs both on every route. Teardown runs
	// with the shell.
	onMount(() => {
		systemStore.init();
		controlsStore.init();
		return () => {
			systemStore.disconnect();
			controlsStore.disconnect();
		};
	});
</script>

<div class="flex h-screen overflow-hidden">
	<Sidebar />
	<div class="flex-1 flex flex-col min-w-0 overflow-hidden">
		<Header />
		<main class="flex-1 overflow-y-auto overflow-x-hidden bg-[#0f1218]">
			{@render children()}
		</main>
	</div>
</div>
