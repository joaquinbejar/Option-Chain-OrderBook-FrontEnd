<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/controls');
	});
</script>

<div class="flex items-center justify-center h-full">
	<p class="text-text-muted">Redirecting to Controls...</p>
</div>
