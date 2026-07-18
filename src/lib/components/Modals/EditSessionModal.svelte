<script lang="ts">
	import { getState, updateSession, deleteSession } from '$lib/state/store.svelte.js';

	let {
		show = false,
		sessionId = null as string | null,
		onClose = () => {}
	}: {
		show: boolean;
		sessionId: string | null;
		onClose: () => void;
	} = $props();

	let s = $derived(getState());

	let session = $derived(
		sessionId ? s.sessions.find((ses) => ses.id === sessionId) : null
	);

	let editDate = $state('');

	// Sync editDate when session changes
	$effect(() => {
		if (session) {
			editDate = session.date;
		}
	});

	function fmt(sec: number | undefined): string {
		if (!sec) return '0m';
		const h = Math.floor(sec / 3600);
		const m = Math.round((sec % 3600) / 60);
		return h > 0 ? `${h}h ${m}m` : `${m}m`;
	}

	function handleSave() {
		if (!editDate || !sessionId) {
			alert('Selecciona una fecha válida.');
			return;
		}
		updateSession(sessionId, { date: editDate });
		onClose();
	}

	function handleDelete() {
		if (!sessionId) return;
		if (!confirm('¿Eliminar esta sesión? No se puede deshacer.')) return;
		deleteSession(sessionId);
		onClose();
	}
</script>

{#if show && session}
	<div
		id="edit-session-modal"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) onClose();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
		role="presentation"
	>
		<div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
			<!-- Header -->
			<div class="bg-[#E53935] text-white px-5 py-4 flex items-center justify-between">
				<h2 class="text-lg font-bold"><i class="fas fa-edit mr-2"></i>Edit Session</h2>
				<button
					type="button"
					id="edit-session-close"
					class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
					onclick={onClose}
					aria-label="Close"
				>
					<i class="fas fa-times"></i>
				</button>
			</div>

			<!-- Body -->
			<div class="p-5 space-y-4">
				<!-- Date -->
				<div>
					<label for="edit-session-date" class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-1 block">
						Date
					</label>
					<input
						id="edit-session-date"
						type="date"
						class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#E53935]/50 focus:border-[#E53935] transition"
						bind:value={editDate}
					/>
				</div>

				<!-- Routine name (read-only) -->
				<div>
					<span class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-1 block">
						Routine
					</span>
					<p id="edit-session-routine" class="text-gray-800 font-medium">{session.routineName}</p>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<!-- Scheduled time -->
					<div>
						<span class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-1 block">
							Scheduled
						</span>
						<p id="edit-session-scheduled" class="text-gray-800 font-medium tabular-nums">{fmt(session.scheduledSec)}</p>
					</div>
					<!-- Elapsed time -->
					<div>
						<span class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-1 block">
							Elapsed
						</span>
						<p id="edit-session-elapsed" class="text-gray-800 font-medium tabular-nums">{fmt(session.elapsedSec || session.totalSec)}</p>
					</div>
				</div>

				<!-- Exercises -->
				<div>
					<span class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-1 block">
						Exercises
					</span>
					<div id="edit-session-exercises" class="space-y-1">
						{#each session.exercises as ex (ex.exerciseId + ex.title)}
							<div class="flex items-center gap-2 text-sm text-gray-600">
								<i class="fas fa-check-circle text-green-500 text-[10px]"></i>
								<span>{ex.title}</span>
								{#if ex.statValue != null}
									<span class="text-[#E53935] font-medium ml-auto">
										{ex.statName || ''}: {ex.statValue}
									</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex gap-3 px-5 pb-5">
				<button
					type="button"
					id="edit-session-delete-btn"
					class="py-3 px-4 rounded-xl border border-red-200 text-red-600 font-medium hover:bg-red-50 transition-colors"
					onclick={handleDelete}
				>
					<i class="fas fa-trash mr-1"></i>
					Delete
				</button>
				<button
					type="button"
					id="edit-session-cancel-btn"
					class="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
					onclick={onClose}
				>
					Cancel
				</button>
				<button
					type="button"
					id="edit-session-save-btn"
					class="flex-1 py-3 rounded-xl bg-[#E53935] text-white font-bold hover:bg-[#C62828] transition-colors"
					onclick={handleSave}
				>
					Save
				</button>
			</div>
		</div>
	</div>
{/if}
