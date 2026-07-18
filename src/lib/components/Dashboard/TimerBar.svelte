<script lang="ts">
	import { formatTime } from '$lib/state/utils.js';

	let {
		globalSeconds = 0,
		totalRoutineTime = 0
	}: {
		globalSeconds: number;
		totalRoutineTime: number;
	} = $props();

	let progressPercent = $derived(
		totalRoutineTime > 0 ? Math.min(100, (globalSeconds / totalRoutineTime) * 100) : 0
	);
</script>

<div class="flex items-center justify-between px-4 py-3 bg-white/10 rounded-xl mb-4">
	<div class="flex-1">
		<div class="flex items-center justify-between mb-1">
			<span id="global-practice-timer" class="text-2xl font-bold text-white tabular-nums"
				>{formatTime(globalSeconds)}</span
			>
			<span id="total-routine-time" class="text-sm text-white/70 tabular-nums"
				>{formatTime(totalRoutineTime)}</span
			>
		</div>
		<div class="w-full h-2 bg-white/20 rounded-full overflow-hidden">
			<div
				class="h-full bg-[#10B981] rounded-full transition-all duration-500 ease-linear"
				style="width: {progressPercent}%"
			></div>
		</div>
	</div>
</div>
