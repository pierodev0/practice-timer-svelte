<script lang="ts">
	import { formatTime, formatISOTime } from '$lib/state/utils.js';

	let {
		show = false,
		summary = {
			exercises: 0,
			scheduledSec: 0,
			elapsedSec: 0,
			startedAt: null as string | null,
			completedAt: ''
		},
		onAccept = () => {},
		onCancel = () => {}
	}: {
		show: boolean;
		summary: {
			exercises: number;
			scheduledSec: number;
			elapsedSec: number;
			startedAt: string | null;
			completedAt: string;
		};
		onAccept: () => void;
		onCancel: () => void;
	} = $props();
</script>

{#if show}
	<div
		id="finish-modal"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) onCancel();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') onCancel();
		}}
		role="presentation"
	>
		<div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
			<!-- Header -->
			<div class="bg-[#E53935] text-white px-5 py-4 text-center">
				<i class="fas fa-flag-checkered text-3xl mb-2"></i>
				<h2 class="text-lg font-bold">Finish Routine</h2>
			</div>

			<!-- Body -->
			<div class="p-5 space-y-3">
				<div class="flex justify-between items-center py-2 border-b border-gray-100">
					<span class="text-sm text-gray-500">Exercises completed</span>
					<span id="finish-exercises-count" class="font-bold text-gray-800">{summary.exercises}</span>
				</div>
				<div class="flex justify-between items-center py-2 border-b border-gray-100">
					<span class="text-sm text-gray-500">Scheduled time</span>
					<span id="finish-scheduled-time" class="font-bold text-gray-800 tabular-nums">{formatTime(summary.scheduledSec)}</span>
				</div>
				<div class="flex justify-between items-center py-2 border-b border-gray-100">
					<span class="text-sm text-gray-500">Elapsed time</span>
					<span id="finish-elapsed-time" class="font-bold text-gray-800 tabular-nums">{formatTime(summary.elapsedSec)}</span>
				</div>
				<div class="flex justify-between items-center py-2 border-b border-gray-100">
					<span class="text-sm text-gray-500">Started at</span>
					<span id="finish-start-time" class="font-bold text-gray-800">{formatISOTime(summary.startedAt)}</span>
				</div>
				<div class="flex justify-between items-center py-2">
					<span class="text-sm text-gray-500">Ended at</span>
					<span id="finish-end-time" class="font-bold text-gray-800">{formatISOTime(summary.completedAt)}</span>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex gap-3 px-5 pb-5">
				<button
					type="button"
					id="finish-cancel-btn"
					class="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
					onclick={onCancel}
				>
					Cancel
				</button>
				<button
					type="button"
					id="finish-accept-btn"
					class="flex-1 py-3 rounded-xl bg-[#E53935] text-white font-bold hover:bg-[#C62828] transition-colors"
					onclick={onAccept}
				>
					Accept
				</button>
			</div>
		</div>
	</div>
{/if}
