<script lang="ts">
	let {
		activeTab = 'practice',
		onTabChange = (tab: string) => {}
	}: {
		activeTab: string;
		onTabChange: (tab: string) => void;
	} = $props();

	const tabs = [
		{ id: 'practice', icon: 'fa-music', label: 'Práctica' },
		{ id: 'routines', icon: 'fa-list', label: 'Rutinas' },
		{ id: 'history', icon: 'fa-history', label: 'Historial' },
		{ id: 'stats', icon: 'fa-chart-line', label: 'Stats' },
		{ id: 'settings', icon: 'fa-cog', label: 'Ajustes' }
	];

	function handleTabClick(tabId: string) {
		onTabChange(tabId);
		// If clicking the same active tab, scroll to top
		if (tabId === activeTab) {
			const content = document.querySelector('.view-section.active, .view-section');
			if (content) {
				content.scrollTop = 0;
			}
		}
	}
</script>

<nav
	id="bottom-nav"
	class="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex justify-around items-center shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
>
	{#each tabs as tab}
		<button
			data-tab={tab.id}
			class="bottom-nav-tab"
			class:active={activeTab === tab.id}
			onclick={() => handleTabClick(tab.id)}
		>
			<i class="fas {tab.icon} text-xl"></i>
			<span class="text-[10px] mt-0.5 font-medium">{tab.label}</span>
		</button>
	{/each}
</nav>
