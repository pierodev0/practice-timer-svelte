<script lang="ts">
	import { getFirstImage } from '$lib/state/utils.js';

	let {
		comment = '',
		onImageClick = (_url: string) => {}
	}: {
		comment: string;
		onImageClick: (url: string) => void;
	} = $props();

	let images = $derived(
		comment
			? (comment.match(/(https?:\/\/[^\s]*\.(?:png|jpg|jpeg|gif|webp|svg)[^\s]*)/gi) || [])
			: []
	);

	let allLinks = $derived(
		comment
			? (comment.match(/(https?:\/\/[^\s]+)/gi) || []).filter((url) => !(images as string[]).includes(url))
			: []
	);
</script>

{#if images.length > 0}
	<div id="detail-image-preview" class="flex flex-wrap gap-2 mt-2">
		{#each images as imgUrl}
			<button type="button" onclick={() => onImageClick(imgUrl)} aria-label="View image" class="p-0">
				<img
					src={imgUrl}
					class="w-20 h-20 object-cover rounded-lg border border-gray-200 cursor-zoom-in hover:opacity-80 transition shadow-sm bg-gray-50"
					alt=""
					onerror={(e) => {
						(e.currentTarget as HTMLElement).style.display = 'none';
					}}
				/>
			</button>
		{/each}
	</div>
{/if}

{#if allLinks.length > 0}
	<div id="detail-link-list" class="flex flex-col gap-1 mt-2">
		{#each allLinks as url}
			<a
				href={url}
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center gap-2 text-[#E53935] hover:underline bg-red-50 p-2 rounded text-sm w-fit max-w-full truncate"
			>
				<i class="fas fa-link"></i>
				<span class="truncate">{url}</span>
			</a>
		{/each}
	</div>
{/if}
