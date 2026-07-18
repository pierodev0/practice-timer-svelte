<script lang="ts">
	import { saveBackup, listBackups, loadBackup, deleteBackup } from '$lib/firebase/sync.js';
	import { downloadJSON } from '$lib/state/utils.js';

	let {
		show = false,
		onClose = () => {}
	}: {
		show: boolean;
		onClose: () => void;
	} = $props();

	let backups = $state<
		Array<{ id: string; label: string; createdAt: number }>
	>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Track previous show to detect open transition
	let prevShow = $state(false);
	$effect(() => {
		if (show && !prevShow) {
			loadBackups();
		}
		prevShow = show;
	});

	async function getAuthUser() {
		const { auth: firebaseAuth } = await import('$lib/firebase/config.js');
		return firebaseAuth.currentUser;
	}

	async function loadBackups() {
		loading = true;
		error = null;
		try {
			const user = await getAuthUser();
			if (!user) {
				error = 'Debes iniciar sesión para ver copias de seguridad.';
				loading = false;
				return;
			}
			backups = await listBackups(user.uid);
		} catch (err: any) {
			error = err.message || 'Error al cargar copias';
		} finally {
			loading = false;
		}
	}

	async function handleSaveNew() {
		try {
			const user = await getAuthUser();
			if (!user) {
				alert('Debes iniciar sesión para guardar copias.');
				return;
			}
			const label = prompt('Nombre para esta copia (opcional):');
			await saveBackup(user.uid, label?.trim() || undefined);
			alert('Copia guardada en la nube.');
			await loadBackups();
		} catch (err: any) {
			alert('Error al guardar: ' + (err.message || 'Desconocido'));
		}
	}

	async function handleRestore(backupId: string) {
		if (!confirm('¿Restaurar esta copia? Se sobreescribirán todos los datos actuales.')) return;
		try {
			const user = await getAuthUser();
			if (!user) return;

			const backup = await loadBackup(user.uid, backupId);
			if (!backup || !backup.data) {
				alert('Copia no encontrada.');
				return;
			}

			const mod = await import('$lib/state/store.svelte.js');
			mod.setRoutines(backup.data.routines || []);
			mod.setStats(backup.data.stats || {});
			mod.setSessions(backup.data.sessions || []);
			if (backup.data.currentRoutineId) {
				mod.setCurrentRoutineId(backup.data.currentRoutineId);
			}

			mod.saveData();

			const { getState, getCurrentRoutine, pauseSequence } = mod;
			const s = getState();
			if (s.isExercisePlaying) {
				pauseSequence();
			}

			mod.setActiveExerciseId(null);
			mod.setExerciseRemaining(0);
			mod.setGlobalSeconds(0);

			const routine = getCurrentRoutine();
			routine.exercises.forEach((e: any) => {
				e.completed = false;
				e.remainingSec = e.durationSec;
				e.currentRep = 1;
			});

			mod.saveData();
			alert('Copia restaurada correctamente.');
			onClose();
		} catch (err: any) {
			alert('Error al restaurar: ' + (err.message || 'Desconocido'));
		}
	}

	async function handleExport(backupId: string) {
		try {
			const user = await getAuthUser();
			if (!user) return;

			const backup = await loadBackup(user.uid, backupId);
			if (!backup) {
				alert('Copia no encontrada.');
				return;
			}
			downloadJSON(JSON.stringify(backup.data, null, 2), `backup_${backupId}.json`);
		} catch (err: any) {
			alert('Error al exportar: ' + (err.message || 'Desconocido'));
		}
	}

	async function handleDelete(backupId: string) {
		if (!confirm('¿Eliminar esta copia de la nube?')) return;
		try {
			const user = await getAuthUser();
			if (!user) return;

			await deleteBackup(user.uid, backupId);
			await loadBackups();
		} catch (err: any) {
			alert('Error al eliminar: ' + (err.message || 'Desconocido'));
		}
	}
</script>

<!-- Fixed fullscreen overlay -->
{#if show}
	<div
		id="backup-manager"
		class="fixed inset-0 bg-white z-[80] flex flex-col"
	>
		<!-- Top bar -->
		<div class="bg-[#E53935] text-white p-4 pt-6 pb-4 shadow-md flex justify-between items-center sticky top-0 z-20">
			<button
				type="button"
				id="backup-manager-back"
				class="text-xl p-2 -ml-2"
				onclick={onClose}
				aria-label="Volver"
			>
				<i class="fas fa-arrow-left"></i>
			</button>
			<h2 class="text-lg font-medium">Copias en la Nube</h2>
			<div class="w-8"></div>
		</div>

		<div class="p-4 space-y-4 pb-12 flex-1 overflow-y-auto">
			<!-- Save new backup -->
			<button
				type="button"
				id="backup-manager-save"
				class="w-full flex items-center gap-3 p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors text-left border border-green-200"
				onclick={handleSaveNew}
			>
				<div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
					<i class="fas fa-plus"></i>
				</div>
				<div>
					<p class="font-medium text-gray-800 text-sm">Guardar copia ahora</p>
					<p class="text-xs text-gray-400">Crea un snapshot de todos tus datos en la nube</p>
				</div>
			</button>

			<!-- Backup list -->
			<div id="backup-manager-list" class="space-y-2">
				{#if loading}
					<p class="text-center text-gray-400 py-8 text-sm">
						<i class="fas fa-cloud text-2xl block mb-2"></i>
						Cargando copias...
					</p>
				{:else if error}
					<p class="text-center text-red-400 py-8 text-sm">
						<i class="fas fa-exclamation-circle text-2xl block mb-2"></i>
						{error}
					</p>
				{:else if backups.length === 0}
					<p class="text-center text-gray-400 py-8 text-sm">
						<i class="fas fa-inbox text-2xl block mb-2"></i>
						No hay copias guardadas
					</p>
				{:else}
					{#each backups as backup (backup.id)}
						<div class="card p-3 flex items-center justify-between gap-2">
							<div class="flex-1 min-w-0">
								<p class="font-medium text-gray-800 text-sm truncate">{backup.label || 'Copia'}</p>
								<p class="text-xs text-gray-400">
									{backup.createdAt ? new Date(backup.createdAt).toLocaleString() : '—'}
								</p>
							</div>
							<div class="flex gap-1 flex-shrink-0">
								<button
									type="button"
									class="w-8 h-8 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors"
									title="Restaurar"
									onclick={() => handleRestore(backup.id)}
								>
									<i class="fas fa-download text-xs"></i>
								</button>
								<button
									type="button"
									class="w-8 h-8 rounded-full flex items-center justify-center text-green-600 hover:bg-green-50 transition-colors"
									title="Exportar JSON"
									onclick={() => handleExport(backup.id)}
								>
									<i class="fas fa-file-export text-xs"></i>
								</button>
								<button
									type="button"
									class="w-8 h-8 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
									title="Eliminar"
									onclick={() => handleDelete(backup.id)}
								>
									<i class="fas fa-trash text-xs"></i>
								</button>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}
