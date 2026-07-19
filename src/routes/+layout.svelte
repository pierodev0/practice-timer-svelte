<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import ImageLightbox from '$lib/components/Modals/ImageLightbox.svelte';
	import StatInputModal from '$lib/components/Modals/StatInputModal.svelte';
	import EditStatsModal from '$lib/components/Modals/EditStatsModal.svelte';
	import EditSessionModal from '$lib/components/Modals/EditSessionModal.svelte';
	import FinishModal from '$lib/components/Modals/FinishModal.svelte';
	import ResetModal from '$lib/components/Modals/ResetModal.svelte';
	import CreateExerciseModal from '$lib/components/Modals/CreateExerciseModal.svelte';
	import { loadData, saveData, onWorkerTick as storeOnWorkerTick, getState } from '$lib/state/store.svelte.js';
	import {
		getWorker,
		setWorker,
		modal,
		closeFinishModal,
		closeResetModal,
		closeCreateModal,
		closeEditStatsModal,
		closeEditSessionModal,
		closeLightbox
	} from '$lib/state/modal-store.svelte.js';

	let { children } = $props();

	let syncToastTimeout: ReturnType<typeof setTimeout> | null = null;

	// ============================================================
	// Worker start/stop based on play state
	// ============================================================
	$effect(() => {
		const s = getState();
		const w = getWorker();
		if (s.isExercisePlaying) {
			w?.postMessage('start');
		} else if (w) {
			w.postMessage('stop');
		}
	});

	// ============================================================
	// onMount
	// ============================================================
	onMount(() => {
		loadData();

		// --- Web Worker ---
		try {
			const w = new Worker(new URL('$lib/worker.ts', import.meta.url), { type: 'module' });
			w.onmessage = (e: MessageEvent) => {
				if (e.data === 'tick') {
					storeOnWorkerTick();
				}
			};
			setWorker(w);
		} catch (e) {
			console.error('Failed to create worker:', e);
		}

		// --- beforeunload ---
		const handleBeforeUnload = () => saveData();
		window.addEventListener('beforeunload', handleBeforeUnload);

		// --- Service Worker (PWA, only in production) ---
		if ('serviceWorker' in navigator && import.meta.env.PROD) {
			navigator.serviceWorker
				.register('/sw.js')
				.then((reg) => console.log('Service Worker registered', reg))
				.catch((err) => console.log('Service Worker failed', err));
		}

		// --- Firebase Auth & Sync ---
		initFirebase();

		return () => {
			const w = getWorker();
			w?.terminate();
			setWorker(null);
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	// ============================================================
	// Firebase
	// ============================================================
	async function initFirebase() {
		try {
			const { handleRedirectResult, observeAuth } = await import('$lib/firebase/auth.js');
			const { downloadAndMergeState, startSyncListener, stopSyncListener } = await import(
				'$lib/firebase/sync.js'
			);

			await handleRedirectResult();

			observeAuth((user) => {
				modal.currentUser = user;

				if (user) {
					downloadAndMergeState(user.uid).then(() => {
						startSyncListener(user.uid, (merged) => {
							import('$lib/state/store.svelte.js').then((mod) => {
								if (merged.routines) mod.setRoutines(merged.routines);
								if (merged.stats) mod.setStats(merged.stats);
								if (merged.sessions) mod.setSessions(merged.sessions);
								if (merged.currentRoutineId) mod.setCurrentRoutineId(merged.currentRoutineId);
								mod.saveData(true);
							});
						});
					});
				} else {
					stopSyncListener();
				}
			});

			window.addEventListener('sync-status', ((e: CustomEvent) => {
				modal.syncStatus = e.detail.status;
				if (e.detail.status === 'synced') {
					modal.lastSyncTime = new Date().toLocaleString();
				}
				modal.showSyncToast = true;
				if (syncToastTimeout) clearTimeout(syncToastTimeout);
				syncToastTimeout = setTimeout(() => {
					modal.showSyncToast = false;
				}, 3000);
			}) as EventListener);
		} catch (err) {
			console.warn('Firebase init skipped (offline):', err);
		}
	}
</script>

<svelte:head>
	<title>Practice Timer</title>
	<meta name="theme-color" content="#E53935" />
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<link rel="manifest" href="manifest.json" />
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<link rel="icon" type="image/x-icon" href="icon-192.png" />
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<link rel="apple-touch-icon" href="icon-192.png" />
</svelte:head>

<!-- Sync status toast -->
{#if modal.showSyncToast}
	<div
		class="fixed top-4 right-4 z-[9999] px-4 py-2 rounded-lg shadow-lg text-white text-sm transition-all"
		class:bg-green-500={modal.syncStatus === 'synced'}
		class:bg-yellow-500={modal.syncStatus === 'syncing'}
		class:bg-red-500={modal.syncStatus === 'error'}
	>
		{#if modal.syncStatus === 'syncing'}
			<i class="fas fa-sync fa-spin mr-2"></i>Sincronizando...
		{:else if modal.syncStatus === 'synced'}
			<i class="fas fa-check-circle mr-2"></i>Sincronizado
		{:else if modal.syncStatus === 'error'}
			<i class="fas fa-exclamation-circle mr-2"></i>Error de sincronización
		{/if}
	</div>
{/if}

<!-- Modals -->
<ImageLightbox show={modal.showLightbox} imageUrl={modal.lightboxUrl} onClose={closeLightbox} />

{#if modal.showStatModal && modal.statModalConfig}
	<StatInputModal
		show={modal.showStatModal}
		statName={modal.statModalConfig.statName}
		onSave={modal.statModalConfig.onSave}
		onSkip={modal.statModalConfig.onSkip}
	/>
{/if}

<EditStatsModal show={modal.showEditStatsModal} onClose={closeEditStatsModal} />
<EditSessionModal
	show={modal.showEditSessionModal}
	sessionId={modal.editSessionId}
	onClose={closeEditSessionModal}
/>

{#if modal.showFinishModal && modal.finishModalSummary}
	<FinishModal
		show={modal.showFinishModal}
		summary={modal.finishModalSummary}
		onAccept={modal.finishModalOnAccept ?? closeFinishModal}
		onCancel={modal.finishModalOnCancel ?? closeFinishModal}
	/>
{/if}

<ResetModal show={modal.showResetModal} onConfirm={modal.resetModalOnConfirm ?? closeResetModal} onCancel={modal.resetModalOnCancel ?? closeResetModal} />
<CreateExerciseModal show={modal.showCreateModal} onClose={closeCreateModal} />

<!-- Route content -->
<div class="view-section active">
	{@render children()}
</div>

<!-- Bottom Navigation -->
<BottomNav />
