<script lang="ts">
	import { onMount } from 'svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import { loadData } from '$lib/state/store.svelte.js';

	let activeTab = $state('practice');
	let worker: Worker | null = null;

	onMount(() => {
		// Initialize store from localStorage
		loadData();

		// Create Web Worker
		try {
			worker = new Worker(new URL('$lib/worker.ts', import.meta.url), { type: 'module' });
			worker.onmessage = (e: MessageEvent) => {
				if (e.data === 'tick') {
					// onWorkerTick will be wired when store has the function
					// For now, the worker is created but idle
				}
			};
		} catch (e) {
			console.error('Failed to create worker:', e);
		}

		// Save data on page leave
		const handleBeforeUnload = () => {
			// saveData() will be called explicitly before unload
		};
		window.addEventListener('beforeunload', handleBeforeUnload);

		return () => {
			worker?.terminate();
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	function onTabChange(tab: string) {
		activeTab = tab;
	}
</script>

<!-- Views -->
<div class="view-section active">
	<!-- Practice Tab -->
	{#if activeTab === 'practice'}
		<div class="flex flex-col h-full">
			<header class="bg-[#E53935] text-white pt-4 pb-6 px-4 rounded-b-3xl shadow-lg z-10 relative">
				<div class="flex justify-center items-center mb-4">
					<h1 class="text-lg font-medium">Practice Timer</h1>
				</div>
				<div class="text-center py-4 text-white/80">
					<i class="fas fa-music text-4xl"></i>
					<p class="mt-2 text-sm">Practice view will be implemented in PR 2</p>
				</div>
			</header>
		</div>

		<!-- Routines Tab -->
	{:else if activeTab === 'routines'}
		<div class="bg-[#E53935] text-white p-4 pt-6 pb-4 shadow-md sticky top-0 z-20">
			<h2 class="text-lg font-medium text-center"><i class="fas fa-list mr-2"></i>Rutinas</h2>
		</div>
		<div class="p-4 text-center text-gray-400 py-12">
			<i class="fas fa-list text-4xl block mb-2"></i>
			<p>Routines view will be implemented in PR 3</p>
		</div>

		<!-- History Tab -->
	{:else if activeTab === 'history'}
		<div class="bg-[#E53935] text-white p-4 pt-6 pb-4 shadow-md sticky top-0 z-20">
			<h2 class="text-lg font-medium text-center"><i class="fas fa-history mr-2"></i>Historial</h2>
		</div>
		<div class="p-4 text-center text-gray-400 py-12">
			<i class="fas fa-history text-4xl block mb-2"></i>
			<p>History view will be implemented in PR 3</p>
		</div>

		<!-- Stats Tab -->
	{:else if activeTab === 'stats'}
		<div class="bg-[#E53935] text-white p-4 pt-6 pb-4 shadow-md sticky top-0 z-20">
			<h2 class="text-lg font-medium text-center"><i class="fas fa-chart-line mr-2"></i>Stats</h2>
		</div>
		<div class="p-4 text-center text-gray-400 py-12">
			<i class="fas fa-chart-line text-4xl block mb-2"></i>
			<p>Stats view will be implemented in PR 3</p>
		</div>

		<!-- Settings Tab -->
	{:else if activeTab === 'settings'}
		<div class="bg-[#E53935] text-white p-4 pt-6 pb-4 shadow-md sticky top-0 z-20">
			<h2 class="text-lg font-medium text-center"><i class="fas fa-cog mr-2"></i>Ajustes</h2>
		</div>
		<div class="p-4 text-center text-gray-400 py-12">
			<i class="fas fa-cog text-4xl block mb-2"></i>
			<p>Settings view will be implemented in PR 4</p>
		</div>
	{/if}
</div>

<!-- Bottom Navigation -->
<BottomNav {activeTab} onTabChange={onTabChange} />
