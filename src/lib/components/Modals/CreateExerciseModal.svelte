<script lang="ts">
	import { getState, addNewExercise, adjustNewBPM, adjustNewReps, adjustNewTime } from '$lib/state/store.svelte.js';

	let {
		show = false,
		onClose = () => {}
	}: {
		show: boolean;
		onClose: () => void;
	} = $props();

	let s = $derived(getState());

	let title = $state('');
	let statName = $state('');
	let autoStart = $state(true);

	function handleCreate() {
		const t = title.trim();
		if (!t) {
			alert('Please enter a title for the exercise.');
			return;
		}
		addNewExercise(t);

		// Reset form
		title = '';
		statName = '';
		autoStart = true;
		onClose();
	}

	function handleCancel() {
		title = '';
		statName = '';
		autoStart = true;
		onClose();
	}
</script>

{#if show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) handleCancel();
		}}
	>
		<div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
			<!-- Header -->
			<div class="bg-[#E53935] text-white px-5 py-4">
				<h2 class="text-lg font-bold"><i class="fas fa-plus-circle mr-2"></i>New Exercise</h2>
			</div>

			<!-- Body -->
			<div class="p-5 space-y-4">
				<!-- Title -->
				<div>
					<label class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-1 block">
						Title *
					</label>
					<input
						id="new-title"
						type="text"
						class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#E53935]/50 focus:border-[#E53935] transition"
						placeholder="Exercise name"
						bind:value={title}
					/>
				</div>

				<!-- Stat name -->
				<div>
					<label class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-1 block">
						Statistic Name (optional)
					</label>
					<input
						id="new-stat-name"
						type="text"
						class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#E53935]/50 focus:border-[#E53935] transition"
						placeholder="e.g. Changes, Clean Hits"
						bind:value={statName}
					/>
				</div>

				<!-- Controls -->
				<div class="grid grid-cols-2 gap-3">
					<!-- Reps -->
					<div class="bg-gray-50 rounded-xl p-3 border border-gray-100">
						<label class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2 block">
							Reps
						</label>
						<div class="flex items-center justify-between">
							<button
								type="button"
								id="new-reps-minus"
								class="w-8 h-8 rounded-full bg-white text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors shadow-sm"
								onclick={() => adjustNewReps(-1)}
								aria-label="Decrease reps"
							>
								<i class="fas fa-minus text-xs"></i>
							</button>
							<span id="new-reps-display" class="text-lg font-bold text-gray-800">{s.newExerciseForm.reps}</span>
							<button
								type="button"
								id="new-reps-plus"
								class="w-8 h-8 rounded-full bg-white text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors shadow-sm"
								onclick={() => adjustNewReps(1)}
								aria-label="Increase reps"
							>
								<i class="fas fa-plus text-xs"></i>
							</button>
						</div>
					</div>

					<!-- BPM -->
					<div class="bg-gray-50 rounded-xl p-3 border border-gray-100">
						<label class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2 block">
							BPM
						</label>
						<div class="flex items-center justify-between">
							<button
								type="button"
								id="new-bpm-minus"
								class="w-8 h-8 rounded-full bg-white text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors shadow-sm"
								onclick={() => adjustNewBPM(-5)}
								aria-label="Decrease BPM"
							>
								<i class="fas fa-minus text-xs"></i>
							</button>
							<span id="new-bpm-display" class="text-lg font-bold text-gray-800">{s.newExerciseForm.bpm} BPM</span>
							<button
								type="button"
								id="new-bpm-plus"
								class="w-8 h-8 rounded-full bg-white text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors shadow-sm"
								onclick={() => adjustNewBPM(5)}
								aria-label="Increase BPM"
							>
								<i class="fas fa-plus text-xs"></i>
							</button>
						</div>
					</div>

					<!-- Minutes -->
					<div class="bg-gray-50 rounded-xl p-3 border border-gray-100">
						<label class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2 block">
							Minutes
						</label>
						<div class="flex items-center justify-between">
							<button
								type="button"
								id="new-min-minus"
								class="w-8 h-8 rounded-full bg-white text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors shadow-sm"
								onclick={() => adjustNewTime('min', -1)}
								aria-label="Decrease minutes"
							>
								<i class="fas fa-minus text-xs"></i>
							</button>
							<span id="new-min-display" class="text-lg font-bold text-gray-800">{s.newExerciseForm.min} min</span>
							<button
								type="button"
								id="new-min-plus"
								class="w-8 h-8 rounded-full bg-white text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors shadow-sm"
								onclick={() => adjustNewTime('min', 1)}
								aria-label="Increase minutes"
							>
								<i class="fas fa-plus text-xs"></i>
							</button>
						</div>
					</div>

					<!-- Seconds -->
					<div class="bg-gray-50 rounded-xl p-3 border border-gray-100">
						<label class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2 block">
							Seconds
						</label>
						<div class="flex items-center justify-between">
							<button
								type="button"
								id="new-sec-minus"
								class="w-8 h-8 rounded-full bg-white text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors shadow-sm"
								onclick={() => adjustNewTime('sec', -5)}
								aria-label="Decrease seconds"
							>
								<i class="fas fa-minus text-xs"></i>
							</button>
							<span id="new-sec-display" class="text-lg font-bold text-gray-800"
								>{s.newExerciseForm.sec.toString().padStart(2, '0')} sec</span
							>
							<button
								type="button"
								id="new-sec-plus"
								class="w-8 h-8 rounded-full bg-white text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors shadow-sm"
								onclick={() => adjustNewTime('sec', 5)}
								aria-label="Increase seconds"
							>
								<i class="fas fa-plus text-xs"></i>
							</button>
						</div>
					</div>
				</div>

				<!-- Autostart -->
				<label class="flex items-center gap-2 cursor-pointer select-none">
					<input
						id="new-autostart"
						type="checkbox"
						class="w-4 h-4 rounded border-gray-300 accent-[#E53935]"
						bind:checked={autoStart}
					/>
					<span class="text-sm text-gray-600 font-medium">Auto-start metronome</span>
				</label>
			</div>

			<!-- Footer -->
			<div class="flex gap-3 px-5 pb-5">
				<button
					type="button"
					id="create-modal-cancel"
					class="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
					onclick={handleCancel}
				>
					Cancel
				</button>
				<button
					type="button"
					id="create-modal-create"
					class="flex-1 py-3 rounded-xl bg-[#E53935] text-white font-bold hover:bg-[#C62828] transition-colors"
					onclick={handleCreate}
				>
					Create
				</button>
			</div>
		</div>
	</div>
{/if}
