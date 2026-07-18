<script lang="ts">
	import { getState, saveData } from '$lib/state/store.svelte.js';

	let {
		show = false,
		onClose = () => {}
	}: {
		show: boolean;
		onClose: () => void;
	} = $props();

	let s = $derived(getState());

	type StatItem = {
		routineId: string;
		exerciseId: string;
		index: number;
		title: string;
		statName: string;
		date: string;
		value: number;
	};

	let allLogs = $derived.by((): StatItem[] => {
		const items: StatItem[] = [];
		s.routines.forEach((r) => {
			r.exercises.forEach((e) => {
				if (e.statisticLogs && e.statisticLogs.length > 0) {
					e.statisticLogs.forEach((log, idx) => {
						items.push({
							routineId: r.id,
							exerciseId: e.id,
							index: idx,
							title: e.title,
							statName: e.statisticName || 'Stat',
							date: log.date,
							value: log.value
						});
					});
				}
			});
		});
		items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
		return items;
	});

	function editStatValue(item: StatItem) {
		const r = s.routines.find((x) => x.id === item.routineId);
		if (!r) return;
		const e = r.exercises.find((x) => x.id === item.exerciseId);
		if (!e) return;
		const log = e.statisticLogs[item.index];
		if (!log) return;

		const newVal = prompt(`Edit value for ${e.title} on ${log.date}:`, String(log.value));
		if (newVal !== null && newVal.trim() !== '') {
			const num = parseFloat(newVal);
			if (!isNaN(num)) {
				log.value = num;
				saveData();
			} else {
				alert('Please enter a valid number.');
			}
		}
	}

	function deleteStatLog(item: StatItem) {
		if (!confirm('Are you sure you want to delete this record?')) return;
		const r = s.routines.find((x) => x.id === item.routineId);
		if (!r) return;
		const e = r.exercises.find((x) => x.id === item.exerciseId);
		if (!e) return;
		e.statisticLogs.splice(item.index, 1);
		saveData();
	}
</script>

{#if show}
	<div
		id="edit-stats-modal"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) onClose();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
		role="presentation"
	>
		<div class="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
			<!-- Header -->
			<div class="bg-[#E53935] text-white px-5 py-4 flex items-center justify-between">
				<h2 class="text-lg font-bold"><i class="fas fa-chart-bar mr-2"></i>Edit Stats</h2>
				<button
					type="button"
					id="edit-stats-close"
					class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
					onclick={onClose}
					aria-label="Close"
				>
					<i class="fas fa-times"></i>
				</button>
			</div>

			<!-- List -->
			<div id="edit-stats-list" class="flex-1 overflow-y-auto p-4 space-y-2">
				{#if allLogs.length === 0}
					<div class="text-center text-gray-400 py-8">No statistics recorded yet.</div>
				{:else}
					{#each allLogs as item (item.routineId + item.exerciseId + item.index)}
						<div class="bg-white p-3 rounded shadow-sm border border-gray-100 flex justify-between items-center">
							<div>
								<div class="text-xs text-gray-400 font-bold">{item.date}</div>
								<div class="font-medium text-gray-700 leading-tight">{item.title}</div>
								<div class="text-xs text-[#E53935]">
									{item.statName}: <span class="font-bold text-lg text-gray-800 ml-1">{item.value}</span>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<button
									type="button"
									class="w-8 h-8 rounded-full bg-blue-50 text-blue-500 hover:bg-blue-100 flex items-center justify-center transition-colors"
									onclick={() => editStatValue(item)}
									aria-label="Edit stat"
								>
									<i class="fas fa-pencil-alt text-xs"></i>
								</button>
								<button
									type="button"
									class="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors"
									onclick={() => deleteStatLog(item)}
									aria-label="Delete stat"
								>
									<i class="fas fa-trash text-xs"></i>
								</button>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-4 py-3 border-t border-gray-200 bg-white">
				<button
					type="button"
					id="edit-stats-close-btn"
					class="w-full py-3 rounded-xl bg-[#E53935] text-white font-bold hover:bg-[#C62828] transition-colors"
					onclick={onClose}
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
