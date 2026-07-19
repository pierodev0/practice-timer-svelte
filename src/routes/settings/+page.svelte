<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { getState, getCurrentRoutine } from '$lib/state/store.svelte.js';
	import { showArchivedExercises, exportAllData, deleteAllData } from '$lib/state/backup-ops.js';
	import SyncSection from '$lib/components/Settings/SyncSection.svelte';
	import BackupManager from '$lib/components/Settings/BackupManager.svelte';

	let showBackupManager = $state(false);
	let restoreInput: HTMLInputElement | undefined = $state();

	let s = $derived(getState());
	let routine = $derived(getCurrentRoutine());
	let archivedCount = $derived(routine.exercises.filter((e) => e.archived).length);

	function triggerRestore() { restoreInput?.click(); }

	async function restoreAllData(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files || !input.files[0]) return;
		if (!confirm('Esto sobreescribirá todos los datos actuales. ¿Continuar?')) return;

		const reader = new FileReader();
		reader.onload = async (evt) => {
			try {
				const json = JSON.parse(evt.target?.result as string);
				const mod = await import('$lib/state/store.svelte.js');
				mod.setRoutines(json.routines || []);
				mod.setStats(json.stats || {});
				mod.setSessions(json.sessions || []);
				mod.setCurrentRoutineId(json.routines?.[0]?.id || 'module-1');
				mod.saveData();

				const state = mod.getState();
				if (state.isExercisePlaying) mod.pauseSequence();
				mod.setActiveExerciseId(null);
				mod.setExerciseRemaining(0);
				mod.setGlobalSeconds(0);
				mod.getCurrentRoutine().exercises.forEach((ex: any) => {
					ex.completed = false; ex.remainingSec = ex.durationSec; ex.currentRep = 1;
				});
				mod.saveData();
				alert('Restauración completa.');
			} catch (err) {
				alert('Error al restaurar: ' + (err instanceof Error ? err.message : 'Desconocido'));
			}
		};
		reader.readAsText(input.files[0]);
		input.value = '';
	}
</script>

<div class="bg-[#E53935] text-white p-4 pt-6 pb-4 shadow-md sticky top-0 z-20">
	<h2 class="text-lg font-medium text-center"><i class="fas fa-cog mr-2"></i>Ajustes</h2>
</div>

<div class="p-4 space-y-4 pb-12">
	<!-- Archived Exercises -->
	<div class="card p-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
					<i class="fas fa-box-archive"></i>
				</div>
				<div>
					<p class="font-medium text-gray-800">Ejercicios Archivados</p>
					<p class="text-xs text-gray-400" id="settings-archived-count">{archivedCount} ejercicio{archivedCount !== 1 ? 's' : ''}</p>
				</div>
			</div>
			<button type="button" id="settings-archived-btn" class="text-sm text-[#E53935] font-medium hover:underline" onclick={showArchivedExercises}>Ver</button>
		</div>
	</div>

	<!-- Backup -->
	<div class="card p-4">
		<h3 class="text-xs uppercase text-gray-500 font-bold tracking-wider mb-3">Copia de Seguridad</h3>
		<div class="space-y-3">
			<button type="button" id="settings-export-btn" class="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left" onclick={exportAllData}>
				<div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0"><i class="fas fa-save"></i></div>
				<div><p class="font-medium text-gray-800 text-sm">Backup Completo</p><p class="text-xs text-gray-400">Exportar todas las rutinas + estadísticas</p></div>
			</button>
			<button type="button" id="settings-restore-btn" class="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left" onclick={triggerRestore}>
				<div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0"><i class="fas fa-exclamation-triangle"></i></div>
				<div><p class="font-medium text-gray-800 text-sm">Restaurar Backup</p><p class="text-xs text-gray-400">Sobreescribe todos los datos actuales</p></div>
			</button>
			<input type="file" id="settings-restore-input" class="hidden" accept=".json" bind:this={restoreInput} onchange={restoreAllData} />
			<button type="button" id="settings-cloud-backups-btn" class="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left" onclick={() => (showBackupManager = true)}>
				<div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 flex-shrink-0"><i class="fas fa-cloud-upload-alt"></i></div>
				<div><p class="font-medium text-gray-800 text-sm">Copias en la Nube</p><p class="text-xs text-gray-400">Guardar y restaurar desde Firestore</p></div>
			</button>
		</div>
	</div>

	<!-- Cloud Sync -->
	<SyncSection />

	<!-- Danger Zone -->
	<div class="card p-4 border border-red-200">
		<h3 class="text-xs uppercase text-red-500 font-bold tracking-wider mb-3">Zona de Peligro</h3>
		<button type="button" id="settings-delete-all-btn" class="w-full flex items-center gap-3 p-3 rounded-lg bg-red-50 hover:bg-red-100 transition-colors text-left" onclick={deleteAllData}>
			<div class="w-10 h-10 rounded-full bg-red-200 flex items-center justify-center text-red-700 flex-shrink-0"><i class="fas fa-trash-alt"></i></div>
			<div><p class="font-medium text-red-800 text-sm">Borrar Todos los Datos</p><p class="text-xs text-red-500">Elimina rutinas, estadísticas e historial</p></div>
		</button>
	</div>

	<!-- Links -->
	<div class="card p-4">
		<h3 class="text-xs uppercase text-gray-500 font-bold tracking-wider mb-3">Enlaces</h3>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<button type="button" id="settings-stats-btn" class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left" onclick={() => goto('/stats')}>
			<div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 flex-shrink-0"><i class="fas fa-chart-line"></i></div>
			<div><p class="font-medium text-gray-800 text-sm">Estadísticas y Progreso</p><p class="text-xs text-gray-400">Ver gráficos y datos de práctica</p></div>
		</button>
	</div>

	<!-- App Info -->
	<div class="card p-4 text-center text-xs text-gray-400">
		<p>Music Routine App v2 &mdash; PWA</p>
	</div>
</div>

<!-- Backup Manager overlay -->
<BackupManager show={showBackupManager} onClose={() => (showBackupManager = false)} />
