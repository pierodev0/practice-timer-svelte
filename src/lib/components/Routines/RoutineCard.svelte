<script lang="ts">
	import type { Routine } from '$lib/state/types.js';

	let {
		routine,
		isCurrent = false,
		activeCount = 0,
		archivedCount = 0,
		onSelect = (_id: string) => {},
		onRename = (_id: string) => {},
		onExport = (_id: string) => {},
		onDuplicate = (_id: string) => {},
		onDelete = (_id: string) => {}
	}: {
		routine: Routine;
		isCurrent: boolean;
		activeCount: number;
		archivedCount: number;
		onSelect: (id: string) => void;
		onRename: (id: string) => void;
		onExport: (id: string) => void;
		onDuplicate: (id: string) => void;
		onDelete: (id: string) => void;
	} = $props();

	let menuOpen = $state(false);
	let menuEl = $state<HTMLDivElement | null>(null);
	let menuBtnEl = $state<HTMLButtonElement | null>(null);
	let menuUp = $state(false);

	function toggleMenu(e: MouseEvent) {
		e.stopPropagation();
		if (menuOpen) {
			menuOpen = false;
			return;
		}

		// Position dropdown dynamically
		menuOpen = true;
		requestAnimationFrame(() => {
			if (!menuBtnEl) return;
			const btnRect = menuBtnEl.getBoundingClientRect();
			const spaceBelow = window.innerHeight - btnRect.bottom;
			menuUp = spaceBelow < 200;
		});
	}

	function closeMenu() {
		menuOpen = false;
	}

	function handleSelect(e: MouseEvent) {
		e.stopPropagation();
		onSelect(routine.id);
	}

	function handleRename(e: MouseEvent) {
		e.stopPropagation();
		closeMenu();
		onRename(routine.id);
	}

	function handleExport(e: MouseEvent) {
		e.stopPropagation();
		closeMenu();
		onExport(routine.id);
	}

	function handleDuplicate(e: MouseEvent) {
		e.stopPropagation();
		closeMenu();
		onDuplicate(routine.id);
	}

	function handleDelete(e: MouseEvent) {
		e.stopPropagation();
		closeMenu();
		onDelete(routine.id);
	}

	function handleOutsideClick(e: MouseEvent) {
		if (menuEl && !menuEl.contains(e.target as Node)) {
			menuOpen = false;
		}
	}
</script>

<svelte:window onclick={handleOutsideClick} />

<div
	class="p-4 flex items-center justify-between transition-colors"
	class:bg-red-50={isCurrent}
	class:hover:bg-gray-50={!isCurrent}
	data-routine-id={routine.id}
>
	<div class="flex items-center gap-3 flex-1 min-w-0">
		<div
			class="w-10 h-10 rounded-full flex items-center justify-center"
			class:bg-[#E53935]={isCurrent}
			class:text-white={isCurrent}
			class:bg-gray-100={!isCurrent}
			class:text-gray-500={!isCurrent}
		>
			<i class="fas {isCurrent ? 'fa-check' : 'fa-list'}"></i>
		</div>
		<div class="min-w-0">
			<p class="font-medium text-gray-800 line-clamp-2" class:text-[#E53935]={isCurrent}>
				{routine.name}
				{#if isCurrent}
					<span class="text-xs font-normal text-[#E53935] ml-1">· Activa</span>
				{/if}
			</p>
			<p class="text-xs text-gray-400">
				{activeCount} ejercicio{activeCount !== 1 ? 's' : ''}
				{archivedCount > 0 ? ` (${archivedCount} archivados)` : ''}
			</p>
		</div>
	</div>
	<div class="flex items-center gap-1 flex-shrink-0 ml-2">
		<button
			onclick={handleSelect}
			class="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
			class:text-[#E53935]={isCurrent}
			class:bg-red-50={isCurrent}
			class:text-gray-400={!isCurrent}
			class:hover:text-[#E53935]={!isCurrent}
			class:hover:bg-red-50={!isCurrent}
			title="Seleccionar"
		>
			<i class="fas fa-play"></i>
		</button>
		<div class="relative" bind:this={menuEl}>
			<button
				bind:this={menuBtnEl}
				onclick={toggleMenu}
				class="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
				title="Menú"
			>
				<i class="fas fa-ellipsis-v"></i>
			</button>
			{#if menuOpen}
				<div
					class="absolute right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[170px] z-50"
					class:dropdown-up={menuUp}
					class:top-full={!menuUp}
					class:mt-1={!menuUp}
					class:bottom-full={menuUp}
					class:mb-1={menuUp}
				>
					<button
						onclick={handleRename}
						class="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left"
					>
						<i class="fas fa-pencil-alt text-xs w-4"></i>Renombrar
					</button>
					<button
						onclick={handleExport}
						class="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors text-left"
					>
						<i class="fas fa-file-export text-xs w-4"></i>Exportar
					</button>
					<button
						onclick={handleDuplicate}
						class="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors text-left"
					>
						<i class="fas fa-copy text-xs w-4"></i>Duplicar
					</button>
					<hr class="my-1 border-gray-100" />
					<button
						onclick={handleDelete}
						class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
					>
						<i class="fas fa-trash text-xs w-4"></i>Eliminar
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>
