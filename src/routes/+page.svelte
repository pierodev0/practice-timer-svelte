<script lang="ts">
	import { onMount } from 'svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import Dashboard from '$lib/components/Dashboard/Dashboard.svelte';
	import DetailsView from '$lib/components/Details/DetailsView.svelte';
	import RoutinesView from '$lib/components/Routines/RoutinesView.svelte';
	import HistoryView from '$lib/components/History/HistoryView.svelte';
	import StatsView from '$lib/components/Stats/StatsView.svelte';
	import CreateExerciseModal from '$lib/components/Modals/CreateExerciseModal.svelte';
	import StatInputModal from '$lib/components/Modals/StatInputModal.svelte';
	import FinishModal from '$lib/components/Modals/FinishModal.svelte';
	import ResetModal from '$lib/components/Modals/ResetModal.svelte';
	import ImageLightbox from '$lib/components/Modals/ImageLightbox.svelte';
	import EditStatsModal from '$lib/components/Modals/EditStatsModal.svelte';
	import EditSessionModal from '$lib/components/Modals/EditSessionModal.svelte';
	import {
		getState,
		getCurrentRoutine,
		getExerciseById,
		getVisibleExercises,
		loadData,
		saveData,
		pauseSequence,
		playExercise,
		onWorkerTick as storeOnWorkerTick,
		setViewingExerciseId,
		setActiveExerciseId,
		setExerciseRemaining,
		setGlobalSeconds,
		setSessionStartedAt,
		setPendingDetailCompletion,
		resetRoutine as storeResetRoutine,
		addSession,
		recordProgressSeconds
	} from '$lib/state/store.svelte.js';
	import { todayStr } from '$lib/state/utils.js';
	import { playBellSound } from '$lib/audio.js';

	let activeTab = $state('practice');
	let worker: Worker | null = null;

	// ============================================================
	// Firebase & Cloud Sync State
	// ============================================================
	let syncStatus = $state<'idle' | 'syncing' | 'synced' | 'error'>('idle');
	let currentUser = $state<any>(null);
	let showSyncToast = $state(false);
	let syncToastTimeout: ReturnType<typeof setTimeout> | null = null;

	// ============================================================
	// Modal states
	// ============================================================
	let showCreateModal = $state(false);
	let showStatModal = $state(false);
	let statModalConfig = $state<{
		statName: string;
		onSave: (v: number) => void;
		onSkip: () => void;
	} | null>(null);
	let showFinishModal = $state(false);
	let finishModalSummary = $state<{
		exercises: number;
		scheduledSec: number;
		elapsedSec: number;
		startedAt: string | null;
		completedAt: string;
	} | null>(null);
	let showResetModal = $state(false);
	let resetConfirmed = $state(false);
	let showLightbox = $state(false);
	let lightboxUrl = $state('');
	let showEditStatsModal = $state(false);
	let showEditSessionModal = $state(false);
	let editSessionId = $state<string | null>(null);

	// ============================================================
	// Derived state
	// ============================================================
	let s = $derived(getState());

	// ============================================================
	// Worker setup + Firebase init
	// ============================================================
	onMount(() => {
		loadData();

		// Web Worker
		try {
			worker = new Worker(new URL('$lib/worker.ts', import.meta.url), { type: 'module' });
			worker.onmessage = (e: MessageEvent) => {
				if (e.data === 'tick') {
					storeOnWorkerTick();
					if (s.activeExerciseId && s.exerciseRemaining <= 0 && s.isExercisePlaying) {
						handleExerciseCompletion();
					}
				}
			};
		} catch (e) {
			console.error('Failed to create worker:', e);
		}

		const handleBeforeUnload = () => {
			saveData();
		};
		window.addEventListener('beforeunload', handleBeforeUnload);

		// ============================================================
		// Firebase Auth & Sync
		// ============================================================
		initFirebase();

		return () => {
			worker?.terminate();
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	async function initFirebase() {
		try {
			const { handleRedirectResult, observeAuth } = await import('$lib/firebase/auth.js');
			const { downloadAndMergeState, startSyncListener, stopSyncListener } = await import(
				'$lib/firebase/sync.js'
			);

			// Handle redirect result (mobile flow)
			await handleRedirectResult();

			// Observe auth state
			const unsubAuth = observeAuth((user: any) => {
				currentUser = user;

				if (user) {
					downloadAndMergeState(user.uid).then(() => {
						startSyncListener(user.uid, (merged: any) => {
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

			// Listen for sync status events
			window.addEventListener('sync-status', ((e: CustomEvent) => {
				syncStatus = e.detail.status;
				showSyncToast = true;
				if (syncToastTimeout) clearTimeout(syncToastTimeout);
				syncToastTimeout = setTimeout(() => {
					showSyncToast = false;
				}, 3000);
			}) as EventListener);
		} catch (err) {
			console.warn('Firebase init skipped (offline):', err);
		}
	}

	// ============================================================
	// Tab navigation
	// ============================================================
	function onTabChange(tab: string) {
		activeTab = tab;
	}

	// ============================================================
	// Exercise completion flow
	// ============================================================
	function handleExerciseCompletion() {
		const state = getState();
		const activeId = state.activeExerciseId;
		if (!activeId) return;
		const ex = getExerciseById(activeId);
		if (!ex) return;

		playBellSound();

		if (ex.statisticName && !ex.completed) {
			pauseSequence();

			statModalConfig = {
				statName: ex.statisticName,
				onSave: (val: number) => {
					const today = todayStr();
					if (!ex.statisticLogs) ex.statisticLogs = [];
					ex.statisticLogs.push({ date: today, value: val });
					saveData();
					finalizeCompletion(false);
					showStatModal = false;
				},
				onSkip: () => {
					finalizeCompletion(false);
					showStatModal = false;
				}
			};
			showStatModal = true;
			return;
		}

		finalizeCompletion(false);
	}

	function finalizeCompletion(playSound: boolean) {
		const state = getState();
		const activeId = state.activeExerciseId;
		if (!activeId) return;
		const ex = getExerciseById(activeId);
		if (!ex) return;

		if (playSound) playBellSound();

		if (ex.currentRep < ex.reps) {
			ex.currentRep++;
			setExerciseRemaining(ex.durationSec);
			ex.remainingSec = ex.durationSec;
			if (worker) {
				worker.postMessage('stop');
				worker.postMessage('start');
			}
			saveData();
		} else {
			pauseSequence();
			ex.completed = true;
			ex.remainingSec = 0;
			saveData();

			if (state.autoplayRoutine) {
				const routine = getCurrentRoutine();
				const activeList = routine.exercises.filter((e) => !e.archived);
				const idx = activeList.findIndex((e) => e.id === state.activeExerciseId);
				if (idx < activeList.length - 1) {
					setTimeout(() => playExercise(activeList[idx + 1].id), 1500);
				} else {
					handleFinish();
				}
			}
		}
	}

	// ============================================================
	// Details completion flow
	// ============================================================
	function completeDetailExercise() {
		const state = getState();
		const viewingId = state.viewingExerciseId;
		if (!viewingId) return;
		const ex = getExerciseById(viewingId);
		if (!ex) return;

		if (ex.statisticName && !ex.completed) {
			setPendingDetailCompletion(true);
			setActiveExerciseId(ex.id);

			if (state.isExercisePlaying) {
				pauseSequence();
			}

			statModalConfig = {
				statName: ex.statisticName,
				onSave: (val: number) => {
					const today = todayStr();
					if (!ex.statisticLogs) ex.statisticLogs = [];
					ex.statisticLogs.push({ date: today, value: val });
					saveData();
					forceFinishDetail();
					showStatModal = false;
				},
				onSkip: () => {
					forceFinishDetail();
					showStatModal = false;
				}
			};
			showStatModal = true;
			return;
		}

		forceFinishDetail();
	}

	function forceFinishDetail() {
		const state = getState();
		const viewingId = state.viewingExerciseId;
		if (!viewingId) return;
		const ex = getExerciseById(viewingId);
		if (!ex) return;

		let timeToAdd = 0;
		if (state.activeExerciseId === ex.id) {
			timeToAdd = state.exerciseRemaining;
			pauseSequence();
		} else {
			timeToAdd = ex.remainingSec;
		}

		setGlobalSeconds(state.globalSeconds + timeToAdd);
		ex.completed = true;
		ex.remainingSec = 0;
		saveData();
		setViewingExerciseId(null);
	}

	// ============================================================
	// Finish routine flow
	// ============================================================
	function handleFinish() {
		const state = getState();
		pauseSequence();

		if (worker) worker.postMessage('stop');

		const routine = getCurrentRoutine();
		const completedCount = routine.exercises.filter((e) => e.completed).length;
		const scheduledSec = routine.exercises.reduce((sum, e) => sum + e.durationSec * e.reps, 0);

		finishModalSummary = {
			exercises: completedCount,
			scheduledSec,
			elapsedSec: state.sessionStartedAt
				? Math.round((Date.now() - state.sessionStartedAt) / 1000)
				: 0,
			startedAt: state.sessionStartedAt ? new Date(state.sessionStartedAt).toISOString() : null,
			completedAt: new Date().toISOString()
		};
		showFinishModal = true;
	}

	function acceptFinish() {
		const state = getState();
		const routine = getCurrentRoutine();
		const today = todayStr();

		const completedExercises = routine.exercises
			.filter((ex) => ex.completed)
			.map((ex) => ({
				exerciseId: ex.id,
				title: ex.title,
				bpm: ex.bpm,
				durationSec: ex.durationSec,
				statName: ex.statisticName || null,
				statValue:
					ex.statisticLogs && ex.statisticLogs.length > 0
						? ex.statisticLogs[ex.statisticLogs.length - 1].value
						: null,
				repsCompleted: ex.reps,
				comment: ex.comment || ''
			}));

		const now = new Date().toISOString();
		const elapsedSec = state.sessionStartedAt
			? Math.round((Date.now() - state.sessionStartedAt) / 1000)
			: state.globalSeconds;

		if (completedExercises.length > 0 || state.globalSeconds > 0) {
			addSession({
				date: today,
				routineId: routine.id,
				routineName: routine.name,
				startedAt: state.sessionStartedAt ? new Date(state.sessionStartedAt).toISOString() : now,
				completedAt: now,
				scheduledSec: finishModalSummary?.scheduledSec || 0,
				totalSec: state.globalSeconds,
				elapsedSec,
				exercises: completedExercises
			});
		}

		recordProgressSeconds(state.globalSeconds);

		setSessionStartedAt(null);
		setActiveExerciseId(null);
		setExerciseRemaining(0);
		setGlobalSeconds(0);
		routine.exercises.forEach((e) => {
			e.completed = false;
			e.remainingSec = e.durationSec;
			e.currentRep = 1;
		});
		saveData();

		showFinishModal = false;
	}

	function cancelFinish() {
		showFinishModal = false;
	}

	// ============================================================
	// Reset routine flow
	// ============================================================
	function handleReset() {
		pauseSequence();
		if (worker) worker.postMessage('stop');
		showResetModal = true;
	}

	function confirmReset() {
		storeResetRoutine();
		showResetModal = false;
	}

	function cancelReset() {
		showResetModal = false;
	}

	// ============================================================
	// Detail view
	// ============================================================
	function openDetailsView(id: string) {
		setViewingExerciseId(id);
	}

	// ============================================================
	// Image lightbox
	// ============================================================
	function openLightbox(url: string) {
		lightboxUrl = url;
		showLightbox = true;
	}

	// ============================================================
	// Worker command helpers
	// ============================================================
	function dashboardWorkerTick() {
		storeOnWorkerTick();
	}
</script>

<!-- Sync status toast -->
{#if showSyncToast}
	<div
		class="fixed top-4 right-4 z-[9999] px-4 py-2 rounded-lg shadow-lg text-white text-sm transition-all"
		class:bg-green-500={syncStatus === 'synced'}
		class:bg-yellow-500={syncStatus === 'syncing'}
		class:bg-red-500={syncStatus === 'error'}
	>
		{#if syncStatus === 'syncing'}
			<i class="fas fa-sync fa-spin mr-2"></i>Sincronizando...
		{:else if syncStatus === 'synced'}
			<i class="fas fa-check-circle mr-2"></i>Sincronizado
		{:else if syncStatus === 'error'}
			<i class="fas fa-exclamation-circle mr-2"></i>Error de sincronización
		{/if}
	</div>
{/if}

<!-- Modals -->
<ImageLightbox show={showLightbox} imageUrl={lightboxUrl} onClose={() => (showLightbox = false)} />

{#if showStatModal && statModalConfig}
	<StatInputModal
		show={showStatModal}
		statName={statModalConfig.statName}
		onSave={statModalConfig.onSave}
		onSkip={statModalConfig.onSkip}
	/>
{/if}

<EditStatsModal show={showEditStatsModal} onClose={() => (showEditStatsModal = false)} />
<EditSessionModal
	show={showEditSessionModal}
	sessionId={editSessionId}
	onClose={() => {
		showEditSessionModal = false;
		editSessionId = null;
	}}
/>

{#if showFinishModal && finishModalSummary}
	<FinishModal
		show={showFinishModal}
		summary={finishModalSummary}
		onAccept={acceptFinish}
		onCancel={cancelFinish}
	/>
{/if}

<ResetModal show={showResetModal} onConfirm={confirmReset} onCancel={cancelReset} />
<CreateExerciseModal show={showCreateModal} onClose={() => (showCreateModal = false)} />

<!-- Views -->
<div class="view-section active">
	{#if activeTab === 'practice'}
		{#if s.viewingExerciseId}
			<DetailsView onComplete={completeDetailExercise} onLightbox={openLightbox} />
		{:else}
			<Dashboard
				onFinish={handleFinish}
				onReset={handleReset}
				onCreateExercise={() => (showCreateModal = true)}
				onDetail={openDetailsView}
				onLightbox={openLightbox}
				onWorkerTick={dashboardWorkerTick}
			/>
		{/if}

	{:else if activeTab === 'routines'}
		<RoutinesView />

	{:else if activeTab === 'history'}
		<HistoryView
			onEditSession={(id) => {
				editSessionId = id;
				showEditSessionModal = true;
			}}
		/>

	{:else if activeTab === 'stats'}
		<StatsView
			onManageData={() => {
				showEditStatsModal = true;
			}}
		/>

	{:else if activeTab === 'settings'}
		<div class="bg-[#E53935] text-white p-4 pt-6 pb-4 shadow-md sticky top-0 z-20">
			<h2 class="text-lg font-medium text-center"><i class="fas fa-cog mr-2"></i>Ajustes</h2>
		</div>
		<div class="p-4 text-center text-gray-400 py-12">
			<i class="fas fa-cog text-4xl block mb-2"></i>
			<p>Settings view will be implemented in PR 4</p>
		</div>
	{/if}
</div>

<!-- Bottom Navigation -->
<BottomNav {activeTab} onTabChange={onTabChange} />
