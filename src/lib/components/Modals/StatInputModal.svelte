<script lang="ts">
	let {
		show = false,
		statName = '',
		onSave = (_val: number) => {},
		onSkip = () => {}
	}: {
		show: boolean;
		statName: string;
		onSave: (value: number) => void;
		onSkip: () => void;
	} = $props();

	let inputValue = $state('');

	function handleSave() {
		const val = parseFloat(inputValue);
		if (!isNaN(val)) {
			onSave(val);
			inputValue = '';
		}
	}

	function handleSkip() {
		onSkip();
		inputValue = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleSave();
	}
</script>

{#if show}
	<div
		id="stat-input-modal"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) handleSkip();
		}}
	>
		<div class="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
			<!-- Header -->
			<div class="bg-[#E53935] text-white px-5 py-4">
				<h2 class="text-lg font-bold"><i class="fas fa-chart-bar mr-2"></i>Register Stat</h2>
			</div>

			<!-- Body -->
			<div class="p-5">
				<p class="text-sm text-gray-500 mb-3">Enter value for <span class="font-bold text-gray-800">{statName}</span>:</p>
				<input
					id="stat-input-value"
					type="number"
					step="any"
					class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-800 text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-[#E53935]/50 focus:border-[#E53935] transition"
					placeholder="0"
					bind:value={inputValue}
					onkeydown={handleKeydown}
				autofocus={true}
			/>
			</div>

			<!-- Footer -->
			<div class="flex gap-3 px-5 pb-5">
				<button
					type="button"
					id="stat-skip-btn"
					class="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
					onclick={handleSkip}
				>
					Skip
				</button>
				<button
					type="button"
					id="stat-save-btn"
					class="flex-1 py-3 rounded-xl bg-[#E53935] text-white font-bold hover:bg-[#C62828] transition-colors"
					onclick={handleSave}
				>
					Save
				</button>
			</div>
		</div>
	</div>
{/if}
