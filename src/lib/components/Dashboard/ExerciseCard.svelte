<script lang="ts">
	import { formatTime, getFirstImage, getFirstUrl } from '$lib/state/utils.js';
	import type { Exercise } from '$lib/state/types.js';

	let {
		exercise,
		isActive = false,
		isTimerRunning = false,
		remaining = 0,
		onStartStop = (_id: string) => {},
		onDetail = (_id: string) => {},
		onImageClick = (_url: string) => {},
		onUrlOpen = (_url: string) => {}
	}: {
		exercise: Exercise;
		isActive: boolean;
		isTimerRunning: boolean;
		remaining: number;
		onStartStop: (id: string) => void;
		onDetail: (id: string) => void;
		onImageClick: (url: string) => void;
		onUrlOpen: (url: string) => void;
	} = $props();

	let currentRemaining = $derived(isActive ? remaining : exercise.remainingSec);

	let progressPercent = $derived.by(() => {
		if (exercise.completed) return 100;
		if (exercise.durationSec > 0) {
			return ((exercise.durationSec - currentRemaining) / exercise.durationSec) * 100;
		}
		return 0;
	});

	let timeText = $derived.by(() => {
		if (exercise.completed) {
			return `${formatTime(exercise.durationSec)}/${formatTime(exercise.durationSec)}`;
		}
		return `${formatTime(currentRemaining)}/${formatTime(exercise.durationSec)}`;
	});

	let imgUrl = $derived(getFirstImage(exercise.comment));
	let anyUrl = $derived(getFirstUrl(exercise.comment));
	let lastStatValue = $derived.by(() => {
		if (exercise.statisticLogs && exercise.statisticLogs.length > 0) {
			return exercise.statisticLogs[exercise.statisticLogs.length - 1].value;
		}
		return null;
	});
</script>

<div
	class="rounded-xl relative overflow-hidden transition-all shadow-sm border border-gray-100 mb-4"
	class:bg-[#D1FAE5]={exercise.completed}
	class:border-green-200={exercise.completed}
	class:bg-[#E0F2F1]={!exercise.completed && isActive}
	class:border-green-100={!exercise.completed && isActive}
	class:scale-[1.02]={!exercise.completed && isActive}
	class:bg-white={!exercise.completed && !isActive}
>
	<!-- Progress bar -->
	<div
		class="absolute inset-0 bg-[rgba(0,200,83,0.2)] z-0 progress-bar-fill"
		style="width: {progressPercent}%"
	></div>

	<div class="flex items-center relative z-10">
		<!-- Drag handle -->
		<div
			class="drag-handle flex items-center justify-center w-10 self-stretch text-gray-300 hover:text-[#E53935] transition-colors active:text-[#E53935] cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
		>
			<i class="fas fa-grip-vertical text-base"></i>
		</div>

		<div class="flex items-center justify-between flex-1 pr-2">
			<div class="flex items-center gap-4 flex-1 p-4">
				<!-- Start/Stop/Check button -->
				{#if exercise.completed}
					<div
						class="w-16 h-14 rounded-lg flex items-center justify-center font-bold text-lg transition-colors z-20 flex-shrink-0 bg-[#10B981] text-white"
					>
						<i class="fas fa-check"></i>
					</div>
				{:else}
					<button
						type="button"
						class="w-16 h-14 rounded-lg flex items-center justify-center font-bold text-lg transition-colors z-20 flex-shrink-0"
						class:bg-[#E53935]={isTimerRunning}
						class:text-white={isTimerRunning}
						class:border-none={isTimerRunning}
						class:btn-secondary={!isTimerRunning}
						onclick={() => onStartStop(exercise.id)}
						aria-label={isTimerRunning ? 'Stop exercise' : 'Start exercise'}
					>
						{isTimerRunning ? 'Stop' : 'Start'}
					</button>
				{/if}

				<!-- Info -->
				<div class="flex-1 min-w-0">
					<h3
						class="font-medium leading-tight"
						class:text-green-800={exercise.completed}
						class:text-gray-800={!exercise.completed}
					>
						{exercise.title}
					</h3>
					<div class="flex items-center mt-1 flex-wrap gap-y-1">
						<p
							class="text-xs flex items-center gap-2"
							class:font-bold={isActive}
							class:text-gray-400={!isActive}
						>
							<span>{timeText}</span>
							<span class="bg-black/5 px-1.5 rounded font-normal text-gray-500"
								>{exercise.bpm} BPM</span
							>
							{#if !exercise.autoStart}
								<i class="fas fa-volume-mute text-xs text-gray-400"></i>
							{/if}
						</p>

						<!-- Reps badge -->
						{#if exercise.reps > 1}
							<span
								class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-bold ml-2"
							>
								Rep {exercise.currentRep}/{exercise.reps}
							</span>
						{/if}

						<!-- Stat badge -->
						{#if exercise.statisticName}
							<span
								class="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded ml-2 border border-purple-200"
							>
								<i class="fas fa-chart-bar mr-1"></i>
								{exercise.statisticName}
								{#if lastStatValue !== null}
									: <span class="font-bold">{lastStatValue}</span>
								{/if}
							</span>
						{/if}
					</div>
				</div>
			</div>

			<!-- Right side: image, link, chevron -->
			<div class="flex items-center">
				{#if imgUrl}
					<button
						type="button"
						class="w-12 h-12 flex-shrink-0 p-0 rounded border border-gray-200 bg-gray-50 shadow-sm cursor-zoom-in hover:opacity-80 transition ml-2 overflow-hidden"
						onclick={() => onImageClick(imgUrl!)}
						aria-label="View image"
					>
						<img
							src={imgUrl}
							class="w-full h-full object-cover"
							alt=""
							onerror={(e) => {
								e.currentTarget.parentElement!.style.display = 'none';
							}}
						/>
					</button>
				{/if}

				{#if anyUrl}
					<button
						type="button"
						class="w-10 h-10 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-[#E53935] hover:bg-gray-100 rounded-full transition ml-1"
						onclick={() => onUrlOpen(anyUrl!)}
						aria-label="Open link"
					>
						<i class="fas fa-external-link-alt"></i>
					</button>
				{/if}

				<!-- Detail chevron -->
				<button
					type="button"
					class="py-4 pl-3 pr-4 text-gray-300 hover:text-[#E53935] cursor-pointer"
					onclick={() => onDetail(exercise.id)}
					aria-label="View details"
				>
					<i class="fas fa-chevron-right"></i>
				</button>
			</div>
		</div>
	</div>
</div>
