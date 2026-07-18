<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getState, getCurrentRoutine, getVisibleExercises, adjustBpm, toggleGlobalAudioOnly, toggleListExercise, pauseSequence, saveData } from '$lib/state/store.svelte.js';
	import { formatTime } from '$lib/state/utils.js';
	import TimerBar from './TimerBar.svelte';
	import ExerciseCard from './ExerciseCard.svelte';
	// SortableInstance is globally declared in app.d.ts

	let {
		onFinish = () => {},
		onReset = () => {},
		onCreateExercise = () => {},
		onDetail = (_id: string) => {},
		onLightbox = (_url: string) => {},
		onWorkerTick: externalWorkerTick = () => {}
	}: {
		onFinish: () => void;
		onReset: () => void;
		onCreateExercise: () => void;
		onDetail: (id: string) => void;
		onLightbox: (url: string) => void;
		onWorkerTick: () => void;
	} = $props();

	let s = $derived(getState());
	let routine = $derived(getCurrentRoutine());
	let visibleExercises = $derived(getVisibleExercises());

	let totalRoutineTime = $derived(
		visibleExercises.reduce((sum, e) => sum + e.durationSec * e.reps, 0)
	);

	// Sortable.js
	let exerciseListEl: HTMLDivElement | undefined = $state();
	let sortableInstance: SortableInstance | null = null;

	onMount(() => {
		if (typeof Sortable !== 'undefined' && exerciseListEl) {
			sortableInstance = new Sortable(exerciseListEl, {
				animation: 200,
				delay: 200,
				delayOnTouchOnly: true,
				handle: '.drag-handle',
				ghostClass: 'sortable-ghost',
				chosenClass: 'sortable-chosen',
				dragClass: 'sortable-drag',
				scroll: true,
				scrollSensitivity: 40,
				scrollSpeed: 10,
				forceFallback: true,
				fallbackClass: 'sortable-fallback',
				onEnd: (evt: { oldIndex: number; newIndex: number }) => {
					const r = getCurrentRoutine();
					const exercises = r.exercises;
					if (evt.oldIndex !== evt.newIndex) {
						const visible = exercises.filter((e) => !e.archived);
						const [moved] = visible.splice(evt.oldIndex, 1);
						visible.splice(evt.newIndex, 0, moved);
						const archived = exercises.filter((e) => e.archived);
						r.exercises = [...visible, ...archived];
						saveData();
					}
				}
			});
		}

		return () => {
			sortableInstance?.destroy();
		};
	});

	function handleStartStop(id: string) {
		toggleListExercise(id);
	}

	function handleDetail(id: string) {
		onDetail(id);
	}

	function handleImageClick(url: string) {
		onLightbox(url);
	}

	function handleUrlOpen(url: string) {
		window.open(url, '_blank');
	}
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<header class="bg-[#E53935] text-white pt-4 pb-6 px-4 rounded-b-3xl shadow-lg z-10 relative">
		<!-- Routine name -->
		<div class="flex justify-center items-center mb-3">
			<h1 id="current-routine-title" class="text-lg font-medium">{routine.name}</h1>
		</div>

		<!-- BPM controls -->
		<div class="flex items-center justify-center gap-4 mb-3">
			<button
				type="button"
				id="bpm-down"
				class="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
				onclick={() => adjustBpm(-1)}
				aria-label="Decrease BPM"
			>
				<i class="fas fa-minus"></i>
			</button>
			<span id="global-bpm-display" class="text-2xl font-bold tabular-nums">{s.bpm} BPM</span>
			<button
				type="button"
				id="bpm-up"
				class="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
				onclick={() => adjustBpm(1)}
				aria-label="Increase BPM"
			>
				<i class="fas fa-plus"></i>
			</button>
		</div>

		<!-- Play button + timer row -->
		<div class="flex items-center justify-center gap-4 mb-3">
			<button
				type="button"
				id="global-play-btn"
				class="w-16 h-16 rounded-full flex items-center justify-center transition-colors {s.isAudioOn ? 'bg-white/40' : ''}"
				onclick={toggleGlobalAudioOnly}
				aria-label={s.isAudioOn ? 'Pause metronome' : 'Play metronome'}
			>
				{#if s.isAudioOn}
					<i class="fas fa-pause text-3xl text-white"></i>
				{:else}
					<i class="fas fa-play text-3xl text-white pl-1"></i>
				{/if}
			</button>
		</div>

		<!-- TimerBar -->
		<TimerBar globalSeconds={s.globalSeconds} {totalRoutineTime} />

		<!-- Autoplay toggle + FINISH + RESET -->
		<div class="flex items-center justify-between">
			<label class="flex items-center gap-2 text-xs text-white/80 cursor-pointer select-none">
				<input
					type="checkbox"
					id="autoplay-toggle"
					class="w-4 h-4 rounded border-white/40 bg-white/10 accent-[#E53935]"
					bind:checked={s.autoplayRoutine}
				/>
				Auto
			</label>
			<div class="flex gap-2">
				<button
					type="button"
					id="finish-btn"
					class="px-4 py-1.5 bg-white text-[#E53935] rounded-full text-sm font-bold hover:bg-white/90 transition-colors"
					onclick={onFinish}
				>
					FINISH
				</button>
				<button
					type="button"
					id="reset-btn"
					class="px-4 py-1.5 bg-white/20 text-white rounded-full text-sm font-bold hover:bg-white/30 transition-colors"
					onclick={onReset}
				>
					RESET
				</button>
			</div>
		</div>
	</header>

	<!-- Exercise list -->
	<div id="exercise-list" bind:this={exerciseListEl} class="flex-1 overflow-y-auto px-4 pt-4 pb-24">
		{#each visibleExercises as ex, i (ex.id)}
			<ExerciseCard
				exercise={ex}
				isActive={ex.id === s.activeExerciseId}
				isTimerRunning={ex.id === s.activeExerciseId && s.isExercisePlaying}
				remaining={s.exerciseRemaining}
				onStartStop={handleStartStop}
				onDetail={handleDetail}
				onImageClick={handleImageClick}
				onUrlOpen={handleUrlOpen}
			/>
		{/each}

		{#if visibleExercises.length === 0}
			<div class="text-center text-gray-400 py-12">
				<i class="fas fa-plus-circle text-4xl block mb-2"></i>
				<p class="text-sm">No exercises yet. Tap + to add one.</p>
			</div>
		{/if}
	</div>

	<!-- FAB: Add exercise -->
	<button
		type="button"
		id="add-exercise-fab"
		class="fixed bottom-20 right-5 w-14 h-14 rounded-full bg-[#E53935] text-white shadow-lg flex items-center justify-center text-2xl hover:bg-[#C62828] transition-colors z-30"
		onclick={onCreateExercise}
		aria-label="Add exercise"
	>
		<i class="fas fa-plus"></i>
	</button>
</div>
