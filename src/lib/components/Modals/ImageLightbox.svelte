<script lang="ts">
	let {
		show = false,
		imageUrl = '',
		onClose = () => {}
	}: {
		show: boolean;
		imageUrl: string;
		onClose: () => void;
	} = $props();
</script>

{#if show}
	<div
		id="image-lightbox"
		class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in"
		onclick={(e) => {
			if (e.target === e.currentTarget) onClose();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
		role="presentation"
	>
		<button
			type="button"
			id="lightbox-close"
			class="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/30 text-white hover:bg-black/50 flex items-center justify-center transition-colors z-10"
			onclick={onClose}
			aria-label="Close lightbox"
		>
			<i class="fas fa-times text-xl"></i>
		</button>
		<img
			id="lightbox-img"
			src={imageUrl}
			class="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-200 scale-95"
			class:scale-100={show}
			alt=""
		/>
	</div>
{/if}

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.animate-fade-in {
		animation: fadeIn 0.2s ease-out;
	}
</style>
