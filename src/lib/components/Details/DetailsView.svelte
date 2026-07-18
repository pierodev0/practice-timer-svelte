<script lang="ts">
	import { onMount } from 'svelte';
	import { getState, getExerciseById, closeDetailsView, updateExerciseTitle, updateDetailStatName, toggleDetailPlay, resetCurrentDetailExercise, adjustDetailReps, adjustDetailBPM, adjustDetailTime, updateDetailAutoStart, updateComment, duplicateExercise, archiveExercise, deleteDetailExercise } from '$lib/state/store.svelte.js';
	import { formatTime } from '$lib/state/utils.js';
	import AttachmentList from './AttachmentList.svelte';

	let {
		onComplete = () => {},
		onLightbox = (_url: string) => {}
	}: {
		onComplete: () => void;
		onLightbox: (url: string) => void;
	} = $props();

	let s = $derived(getState());
	let ex = $derived(s.viewingExerciseId ? getExerciseById(s.viewingExerciseId) : null);

	let currentRemaining = $derived.by(() => {
		if (!ex) return 0;
		return s.activeExerciseId === ex.id ? s.exerciseRemaining : ex.remainingSec;
	});

	let showMenu = $state(false);

	// Close dropdown when clicking outside
	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		const dropdown = document.getElementById('details-menu-dropdown');
		const menuBtn = document.getElementById('details-menu-btn');
		if (
			showMenu &&
			dropdown &&
			menuBtn &&
			!dropdown.contains(target) &&
			!menuBtn.contains(target)
		) {
			showMenu = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

	function handleBack() {
		closeDetailsView();
	}

	function handleTitleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		updateExerciseTitle(target.value);
	}

	function handleStatNameInput(e: Event) {
		const target = e.target as HTMLInputElement;
		updateDetailStatName(target.value);
	}

	function handleAutoStartChange(e: Event) {
		const target = e.target as HTMLInputElement;
		updateDetailAutoStart(target.checked);
	}

	function handleCommentInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		updateComment(target.value);
	}

	function handleDuplicate() {
		duplicateExercise();
	}

	function handleArchive() {
		archiveExercise();
	}

	function handleDelete() {
		if (confirm('Are you sure you want to delete this exercise?')) {
			deleteDetailExercise();
		}
	}
</script>

{#if ex}
	<div id="details-view" class="flex flex-col h-full">
		<!-- Header -->
		<div class="bg-[#E53935] text-white px-4 pt-4 pb-4 rounded-b-3xl shadow-lg z-10 relative">
			<div class="flex items-center mb-3">
				<button
					type="button"
					id="detail-back"
					class="w-10 h-10 flex items-center justify-center -ml-2"
					onclick={handleBack}
					aria-label="Back to dashboard"
				>
					<i class="fas fa-arrow-left text-xl"></i>
				</button>
				<h2 class="text-lg font-medium flex-1 text-center mr-8">Edit Exercise</h2>
			</div>

			<!-- Time display -->
			<div class="text-center mb-3">
				<span id="detail-time-display" class="text-3xl font-bold tabular-nums">
					{formatTime(currentRemaining)}
				</span>
				<div id="detail-reps-indicator" class="text-sm text-white/70 mt-1">
					Rep {ex.currentRep}/{ex.reps}
				</div>
			</div>

			<!-- Action buttons -->
			<div class="flex gap-2">
				<button
					type="button"
					id="detail-reset-btn"
					class="px-3 py-2 bg-white/20 text-white rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
					onclick={resetCurrentDetailExercise}
				>
					Reset
				</button>
				<button
					type="button"
					id="detail-play-btn"
					class="flex-1 py-2 rounded-lg font-bold transition-colors"
					class:btn-primary={s.activeExerciseId === ex.id && s.isExercisePlaying}
					class:bg-white={!(s.activeExerciseId === ex.id && s.isExercisePlaying)}
					class:text-[#E53935]={!(s.activeExerciseId === ex.id && s.isExercisePlaying)}
					onclick={toggleDetailPlay}
				>
					{s.activeExerciseId === ex.id && s.isExercisePlaying ? 'Pause' : 'Start'}
				</button>
				<button
					type="button"
					id="detail-complete-btn"
					class="px-3 py-2 bg-[#10B981] text-white rounded-lg text-sm font-medium hover:bg-[#059669] transition-colors"
					onclick={onComplete}
				>
					Complete
				</button>
			</div>
		</div>

		<!-- Form fields (scrollable) -->
		<div class="flex-1 overflow-y-auto px-4 pt-4 pb-4">
			<!-- Title -->
			<div class="mb-4">
				<label class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-1 block">
					Title
				</label>
				<input
					id="detail-title-input"
					type="text"
					class="w-full p-3 bg-white rounded-xl border border-gray-200 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#E53935]/50 focus:border-[#E53935] transition"
					value={ex.title}
					oninput={handleTitleInput}
				/>
			</div>

			<!-- Stat name -->
			<div class="mb-4">
				<label class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-1 block">
					Statistic Name
				</label>
				<input
					id="detail-stat-name-input"
					type="text"
					class="w-full p-3 bg-white rounded-xl border border-gray-200 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#E53935]/50 focus:border-[#E53935] transition"
					value={ex.statisticName ?? ''}
					oninput={handleStatNameInput}
					placeholder="e.g. Changes, Clean Hits"
				/>
			</div>

			<!-- Controls grid -->
			<div class="grid grid-cols-2 gap-3 mb-4">
				<!-- Reps -->
				<div class="bg-white rounded-xl border border-gray-200 p-3">
					<label class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2 block">
						Reps
					</label>
					<div class="flex items-center justify-between">
						<button
							type="button"
							id="detail-reps-minus"
							class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors"
							onclick={() => adjustDetailReps(-1)}
							aria-label="Decrease reps"
						>
							<i class="fas fa-minus text-xs"></i>
						</button>
						<span id="detail-reps-display" class="text-lg font-bold text-gray-800">{ex.reps}</span>
						<button
							type="button"
							id="detail-reps-plus"
							class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors"
							onclick={() => adjustDetailReps(1)}
							aria-label="Increase reps"
						>
							<i class="fas fa-plus text-xs"></i>
						</button>
					</div>
				</div>

				<!-- Minutes -->
				<div class="bg-white rounded-xl border border-gray-200 p-3">
					<label class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2 block">
						Minutes
					</label>
					<div class="flex items-center justify-between">
						<button
							type="button"
							id="detail-min-minus"
							class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors"
							onclick={() => adjustDetailTime('min', -1)}
							aria-label="Decrease minutes"
						>
							<i class="fas fa-minus text-xs"></i>
						</button>
						<span id="detail-min-display" class="text-lg font-bold text-gray-800"
							>{Math.floor(ex.durationSec / 60)} min</span
						>
						<button
							type="button"
							id="detail-min-plus"
							class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors"
							onclick={() => adjustDetailTime('min', 1)}
							aria-label="Increase minutes"
						>
							<i class="fas fa-plus text-xs"></i>
						</button>
					</div>
				</div>

				<!-- Seconds -->
				<div class="bg-white rounded-xl border border-gray-200 p-3">
					<label class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2 block">
						Seconds
					</label>
					<div class="flex items-center justify-between">
						<button
							type="button"
							id="detail-sec-minus"
							class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors"
							onclick={() => adjustDetailTime('sec', -5)}
							aria-label="Decrease seconds"
						>
							<i class="fas fa-minus text-xs"></i>
						</button>
						<span id="detail-sec-display" class="text-lg font-bold text-gray-800"
							>{(ex.durationSec % 60).toString().padStart(2, '0')} sec</span
						>
						<button
							type="button"
							id="detail-sec-plus"
							class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors"
							onclick={() => adjustDetailTime('sec', 5)}
							aria-label="Increase seconds"
						>
							<i class="fas fa-plus text-xs"></i>
						</button>
					</div>
				</div>

				<!-- BPM -->
				<div class="bg-white rounded-xl border border-gray-200 p-3">
					<label class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2 block">
						BPM
					</label>
					<div class="flex items-center justify-between">
						<button
							type="button"
							id="detail-bpm-minus"
							class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors"
							onclick={() => adjustDetailBPM(-5)}
							aria-label="Decrease BPM"
						>
							<i class="fas fa-minus text-xs"></i>
						</button>
						<span id="detail-bpm" class="text-lg font-bold text-gray-800">{ex.bpm} BPM</span>
						<button
							type="button"
							id="detail-bpm-plus"
							class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors"
							onclick={() => adjustDetailBPM(5)}
							aria-label="Increase BPM"
						>
							<i class="fas fa-plus text-xs"></i>
						</button>
					</div>
				</div>
			</div>

			<!-- Autostart -->
			<div class="mb-4">
				<label class="flex items-center gap-2 cursor-pointer select-none">
					<input
						type="checkbox"
						id="detail-autostart"
						class="w-4 h-4 rounded border-gray-300 accent-[#E53935]"
						checked={ex.autoStart}
						onchange={handleAutoStartChange}
					/>
					<span class="text-sm text-gray-600 font-medium">Auto-start metronome</span>
				</label>
			</div>

			<!-- Comment -->
			<div class="mb-4">
				<label class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-1 block">
					Comment / Notes
				</label>
				<textarea
					id="detail-comment"
					class="w-full p-3 bg-white rounded-xl border border-gray-200 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#E53935]/50 focus:border-[#E53935] transition resize-none"
					rows="4"
					value={ex.comment}
					oninput={handleCommentInput}
					placeholder="Add notes, URLs, or image links..."
				></textarea>
			</div>

			<!-- Attachments -->
			<div class="mb-4">
				<label class="text-xs text-gray-400 font-bold uppercase tracking-wide mb-1 block">
					Attachments
				</label>
				<AttachmentList comment={ex.comment} onImageClick={onLightbox} />
			</div>

			<!-- Advanced actions -->
			<div class="relative mb-4">
				<button
					type="button"
					id="details-menu-btn"
					class="flex items-center gap-2 text-sm text-gray-500 hover:text-[#E53935] transition-colors px-3 py-2 rounded-lg hover:bg-gray-50"
					onclick={() => (showMenu = !showMenu)}
				>
					<i class="fas fa-cog"></i>
					<span>Advanced Actions</span>
					<i class="fas fa-chevron-down text-xs" class:rotate-180={showMenu}></i>
				</button>

				{#if showMenu}
					<div
						id="details-menu-dropdown"
						class="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50 w-48"
					>
						<button
							type="button"
							id="details-menu-duplicate"
							class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#E53935] transition-colors flex items-center gap-2"
							onclick={handleDuplicate}
						>
							<i class="fas fa-copy w-4"></i>
							Duplicate
						</button>
						<button
							type="button"
							id="details-menu-archive"
							class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#E53935] transition-colors flex items-center gap-2"
							onclick={handleArchive}
						>
							<i class="fas fa-archive w-4"></i>
							Archive
						</button>
						<hr class="my-1 border-gray-100" />
						<button
							type="button"
							id="details-menu-delete"
							class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
							onclick={handleDelete}
						>
							<i class="fas fa-trash w-4"></i>
							Delete
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
