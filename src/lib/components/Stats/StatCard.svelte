<script lang="ts">
	let {
		title = '',
		value = '',
		subtitle = '',
		icon = 'fa-clock'
	}: {
		title: string;
		value: string;
		subtitle: string;
		icon: string;
	} = $props();
</script>

<div class="card p-4 text-center">
	<i class="fas {icon} text-[#E53935] text-2xl mb-2"></i>
	<p class="text-2xl font-bold text-gray-800">{value}</p>
	<p class="text-xs text-gray-500 mt-1">{title}</p>
	{#if subtitle}
		<p class="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>
	{/if}
</div>
