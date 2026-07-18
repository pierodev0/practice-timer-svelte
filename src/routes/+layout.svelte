<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Practice Timer</title>
	<meta name="theme-color" content="#E53935" />
	<link rel="manifest" href="manifest.json" />
	<link rel="icon" type="image/x-icon" href="icon-192.png" />
	<link rel="apple-touch-icon" href="icon-192.png" />
</svelte:head>

{@render children()}
