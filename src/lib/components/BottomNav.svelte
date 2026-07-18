<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	const tabs = [
		{ path: '/practice', icon: 'fa-music', label: 'Práctica' },
		{ path: '/routines', icon: 'fa-list', label: 'Rutinas' },
		{ path: '/history', icon: 'fa-history', label: 'Historial' },
		{ path: '/stats', icon: 'fa-chart-line', label: 'Stats' },
		{ path: '/settings', icon: 'fa-cog', label: 'Ajustes' }
	];

	let activePath = $derived(page.url.pathname);

	function handleTabClick(path: string) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(path);
		// If clicking the same active tab, scroll to top
		if (path === activePath) {
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
	{#each tabs as tab (tab.path)}
		<button
			data-tab={tab.path}
			class="bottom-nav-tab"
			class:active={activePath === tab.path}
			onclick={() => handleTabClick(tab.path)}
		>
			<i class="fas {tab.icon} text-xl"></i>
			<span class="text-[10px] mt-0.5 font-medium">{tab.label}</span>
		</button>
	{/each}
</nav>
