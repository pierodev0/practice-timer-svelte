<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto('/practice', { replaceState: true });
	});
</script>
