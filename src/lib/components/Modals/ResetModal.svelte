<script lang="ts">
	let {
		show = false,
		onConfirm = () => {},
		onCancel = () => {}
	}: {
		show: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();
</script>

{#if show}
	<div
		id="reset-modal"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) onCancel();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') onCancel();
		}}
		role="presentation"
	>
		<div class="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
			<!-- Body -->
			<div class="p-6 text-center">
				<div class="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
					<i class="fas fa-exclamation-triangle text-2xl text-[#E53935]"></i>
				</div>
				<h3 class="text-lg font-bold text-gray-800 mb-2">Reset Routine</h3>
				<p class="text-sm text-gray-500">
					This will reset all exercise progress for the current routine. This action cannot be undone.
				</p>
			</div>

			<!-- Footer -->
			<div class="flex gap-3 px-5 pb-5">
				<button
					type="button"
					id="reset-cancel-btn"
					class="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
					onclick={onCancel}
				>
					Cancel
				</button>
				<button
					type="button"
					id="reset-confirm-btn"
					class="flex-1 py-3 rounded-xl bg-[#E53935] text-white font-bold hover:bg-[#C62828] transition-colors"
					onclick={onConfirm}
				>
					OK
				</button>
			</div>
		</div>
	</div>
{/if}
