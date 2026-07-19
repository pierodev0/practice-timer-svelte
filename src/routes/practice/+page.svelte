<script lang="ts">
	import Dashboard from '$lib/components/Dashboard/Dashboard.svelte';
	import DetailsView from '$lib/components/Details/DetailsView.svelte';
	import { getState } from '$lib/state/store.svelte.js';
	import {
		openDetailsView,
		handleExerciseCompletion,
		completeDetailExercise,
		handleFinish,
		handleReset
	} from '$lib/state/practice-ops.js';
	import { openCreateModal, openLightbox } from '$lib/state/modal-store.svelte.js';

	let s = $derived(getState());

	// Exercise completion via effect
	$effect(() => {
		if (s.activeExerciseId && s.exerciseRemaining <= 0 && s.isExercisePlaying) {
			handleExerciseCompletion();
		}
	});

	function onOpenLightbox(url: string) {
		openLightbox(url);
	}
</script>

{#if s.viewingExerciseId}
	<DetailsView onComplete={completeDetailExercise} onLightbox={onOpenLightbox} />
{:else}
	<Dashboard
		onFinish={handleFinish}
		onReset={handleReset}
		onCreateExercise={openCreateModal}
		onDetail={openDetailsView}
		onLightbox={onOpenLightbox}
	/>
{/if}
