<script lang="ts">
	import { getState, saveData, getCurrentRoutine } from '$lib/state/store.svelte.js';
	import { downloadJSON, sanitizeImportedRoutine } from '$lib/state/utils.js';
	import { nanoid } from 'nanoid';
	import RoutineCard from './RoutineCard.svelte';
	import type { Routine } from '$lib/state/types.js';

	// Sort state
	const SORT_MODES = [
		{ key: 'created', label: 'Creado', icon: 'fa-clock', defaultAsc: false },
		{ key: 'alpha', label: 'A-Z', icon: 'fa-sort-alpha-down', defaultAsc: true },
		{ key: 'usage', label: 'Usadas', icon: 'fa-chart-simple', defaultAsc: false }
	];

	let sortMode = $state('created');
	let sortAsc = $state(false);

	let importInputEl = $state<HTMLInputElement | null>(null);

	let s = $derived(getState());

	function getUsageCounts(): Record<string, number> {
		const counts: Record<string, number> = {};
		s.sessions.forEach((ses) => {
			counts[ses.routineId] = (counts[ses.routineId] || 0) + 1;
		});
		return counts;
	}

	function getSortedRoutines(): Routine[] {
		const usage = getUsageCounts();
		return [...s.routines].sort((a, b) => {
			let cmp = 0;
			if (sortMode === 'created') {
				cmp = (a.createdAt || 0) - (b.createdAt || 0);
			} else if (sortMode === 'alpha') {
				cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
			} else if (sortMode === 'usage') {
				cmp = (usage[a.id] || 0) - (usage[b.id] || 0);
			}
			return sortAsc ? cmp : -cmp;
		});
	}

	let sortedRoutines = $derived(getSortedRoutines());

	function handleSortClick(key: string) {
		if (sortMode === key) {
			sortAsc = !sortAsc;
		} else {
			sortMode = key;
			sortAsc = SORT_MODES.find((m) => m.key === key)?.defaultAsc ?? false;
		}
	}

	// ============================================================
	// ROUTINE CRUD
	// ============================================================

	function showNewRoutineInput() {
		const name = prompt('Nueva rutina:');
		if (name && name.trim()) {
			s.routines.push({
				id: nanoid(),
				name: name.trim(),
				exercises: [],
				createdAt: Date.now()
			});
			saveData();
		}
	}

	function handleSelect(id: string) {
		import('$lib/state/store.svelte.js').then((mod) => {
			mod.switchRoutine(id);
		});

		// Navigate to practice tab
		const event = new CustomEvent('tab-change', { detail: { tab: 'practice' } });
		window.dispatchEvent(event);
	}

	function handleRename(id: string) {
		const r = s.routines.find((x) => x.id === id);
		if (!r) return;
		const newName = prompt('Renombrar:', r.name);
		if (newName && newName.trim()) {
			r.name = newName.trim();
			saveData();
		}
	}

	function handleExport(id: string) {
		const r = s.routines.find((x) => x.id === id);
		if (r) {
			downloadJSON(JSON.stringify(r, null, 2), `routine_${r.name.replace(/\W/g, '_')}.json`);
		}
	}

	function handleDuplicate(id: string) {
		const original = s.routines.find((x) => x.id === id);
		if (!original) return;
		const copy: Routine = {
			id: nanoid(),
			name: original.name + ' (Copia)',
			createdAt: Date.now(),
			exercises: original.exercises.map((ex) => ({
				...ex,
				id: nanoid(),
				completed: false,
				remainingSec: ex.durationSec,
				currentRep: 1,
				statisticLogs: []
			}))
		};
		s.routines.push(copy);
		saveData();
	}

	function handleDelete(id: string) {
		if (s.routines.length <= 1) {
			alert('No puedes eliminar la única rutina.');
			return;
		}
		if (!confirm('¿Eliminar esta rutina para siempre?')) return;
		const idx = s.routines.findIndex((r) => r.id === id);
		if (idx === -1) return;
		s.routines.splice(idx, 1);
		if (s.currentRoutineId === id) {
			import('$lib/state/store.svelte.js').then((mod) => {
				mod.setCurrentRoutineId(s.routines[0].id);
				saveData();
			});
		} else {
			saveData();
		}
	}

	function triggerImport() {
		importInputEl?.click();
	}

	function handleImportInput() {
		if (!importInputEl?.files?.[0]) return;
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const json = JSON.parse(e.target?.result as string);
				const toAdd = (Array.isArray(json) ? json : [json]).map((r: any) => ({
					...sanitizeImportedRoutine(r),
					createdAt: r.createdAt || Date.now()
				}));
				s.routines.push(...toAdd);
				saveData();
				alert(`Importadas ${toAdd.length} rutina(s).`);
			} catch (err: any) {
				alert('Error al importar: ' + err.message);
			}
		};
		reader.readAsText(importInputEl.files[0]);
		importInputEl.value = '';
	}

	function getRoutineUsage(id: string): number {
		return s.sessions.filter((ses) => ses.routineId === id).length;
	}
</script>

<div class="bg-[#E53935] text-white p-4 pt-6 pb-4 shadow-md sticky top-0 z-20">
	<h2 class="text-lg font-medium text-center"><i class="fas fa-list mr-2"></i>Rutinas</h2>
</div>

<!-- Action bar -->
<div class="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
	<button
		onclick={showNewRoutineInput}
		class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#E53935] text-white hover:bg-red-700 transition-colors"
	>
		<i class="fas fa-plus"></i>Nueva
	</button>
	<button
		onclick={triggerImport}
		class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
	>
		<i class="fas fa-file-import"></i>Importar
	</button>
	<input
		bind:this={importInputEl}
		type="file"
		accept=".json,application/json"
		class="hidden"
		onchange={handleImportInput}
	/>
	<div class="flex-1"></div>
	<!-- Sort tags -->
	<div class="flex items-center gap-1 overflow-x-auto" id="routines-sort-tags">
		{#each SORT_MODES as mode}
			<button
				onclick={() => handleSortClick(mode.key)}
				class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all select-none whitespace-nowrap"
				class:bg-[#E53935]={sortMode === mode.key}
				class:text-white={sortMode === mode.key}
				class:shadow-sm={sortMode === mode.key}
				class:bg-gray-100={sortMode !== mode.key}
				class:text-gray-600={sortMode !== mode.key}
				class:hover:bg-gray-200={sortMode !== mode.key}
			>
				<i class="fas {mode.icon}"></i>
				<span>{mode.label}</span>
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
				onSelect={handleSelect}
				onRename={handleRename}
				onExport={handleExport}
				onDuplicate={handleDuplicate}
				onDelete={handleDelete}
			/>
		{/each}
	{/if}
</div>
