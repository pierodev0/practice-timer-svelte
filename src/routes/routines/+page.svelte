<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { getState, saveData, getSortedRoutines, createRoutine, renameRoutine, exportRoutine, duplicateRoutineById, deleteRoutineById, importRoutinesFromJson, switchRoutine } from '$lib/state/store.svelte.js';
	import RoutineCard from '$lib/components/Routines/RoutineCard.svelte';

	const SORT_MODES = [
		{ key: 'created', label: 'Creado', icon: 'fa-clock', defaultAsc: false },
		{ key: 'alpha', label: 'A-Z', icon: 'fa-sort-alpha-down', defaultAsc: true },
		{ key: 'usage', label: 'Usadas', icon: 'fa-chart-simple', defaultAsc: false }
	];

	let sortMode = $state('created');
	let sortAsc = $state(false);
	let importInputEl = $state<HTMLInputElement | null>(null);
	let s = $derived(getState());
	let sortedRoutines = $derived(getSortedRoutines(s.routines, s.sessions, sortMode, sortAsc));

	function handleSortClick(key: string) {
		if (sortMode === key) { sortAsc = !sortAsc; }
		else { sortMode = key; sortAsc = SORT_MODES.find((m) => m.key === key)?.defaultAsc ?? false; }
	}

	function showNewRoutineInput() {
		const name = prompt('Nueva rutina:');
		if (name && name.trim()) {
			s.routines.push(createRoutine(name));
			saveData();
		}
	}

	function handleSelect(id: string) {
		switchRoutine(id);
		goto('/practice');
	}

	function handleRename(id: string) {
		const r = s.routines.find((x) => x.id === id);
		if (!r) return;
		const newName = prompt('Renombrar:', r.name);
		if (newName && newName.trim()) {
			renameRoutine(id, newName);
		}
	}

	function handleDuplicate(id: string) {
		duplicateRoutineById(id);
	}

	function handleDelete(id: string) {
		if (deleteRoutineById(id)) return;
		alert('No puedes eliminar la única rutina.');
	}

	function triggerImport() { importInputEl?.click(); }

	function handleImportInput() {
		if (!importInputEl?.files?.[0]) return;
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const msg = importRoutinesFromJson(e.target?.result as string);
				alert(msg);
			} catch (err) {
				alert('Error al importar: ' + (err instanceof Error ? err.message : 'Desconocido'));
			}
		};
		reader.readAsText(importInputEl.files[0]);
		importInputEl.value = '';
	}
</script>

<div class="bg-[#E53935] text-white p-4 pt-6 pb-4 shadow-md sticky top-0 z-20">
	<h2 class="text-lg font-medium text-center"><i class="fas fa-list mr-2"></i>Rutinas</h2>
</div>

<!-- Action bar -->
<div class="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
	<button onclick={showNewRoutineInput}
		class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#E53935] text-white hover:bg-red-700 transition-colors"
	><i class="fas fa-plus"></i>Nueva</button>
	<button onclick={triggerImport}
		class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
	><i class="fas fa-file-import"></i>Importar</button>
	<input bind:this={importInputEl} type="file" accept=".json,application/json" class="hidden" onchange={handleImportInput} />
	<div class="flex-1"></div>
	<div class="flex items-center gap-1 overflow-x-auto" id="routines-sort-tags">
		{#each SORT_MODES as mode (mode.key)}
			<button onclick={() => handleSortClick(mode.key)}
				class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all select-none whitespace-nowrap"
				class:bg-[#E53935]={sortMode === mode.key} class:text-white={sortMode === mode.key}
				class:shadow-sm={sortMode === mode.key} class:bg-gray-100={sortMode !== mode.key}
				class:text-gray-600={sortMode !== mode.key} class:hover:bg-gray-200={sortMode !== mode.key}
			>
				<i class="fas {mode.icon}"></i><span>{mode.label}</span>
				{#if sortMode === mode.key}
					<i class="fas fa-arrow-{sortAsc ? 'up' : 'down'} text-[10px]"></i>
				{/if}
			</button>
		{/each}
	</div>
</div>

<!-- Routine list -->
<div id="routines-list-container">
	{#if s.routines.length === 0}
		<div class="text-center text-gray-400 py-12" id="routines-empty">
			<i class="fas fa-list text-4xl block mb-2"></i>
			<p>No hay rutinas todavía</p>
			<p class="text-xs mt-1">Crea una nueva rutina para empezar</p>
		</div>
	{:else}
		{#each sortedRoutines as routine (routine.id)}
			<RoutineCard
				routine={routine}
				isCurrent={routine.id === s.currentRoutineId}
				activeCount={routine.exercises.filter((e) => !e.archived).length}
				archivedCount={routine.exercises.filter((e) => e.archived).length}
				onSelect={handleSelect} onRename={handleRename}
				onExport={exportRoutine} onDuplicate={handleDuplicate} onDelete={handleDelete}
			/>
		{/each}
	{/if}
</div>
