<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Header from '$lib/components/Header.svelte';

	let { children } = $props();
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
