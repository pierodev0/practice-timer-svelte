<script lang="ts">
	import Dashboard from '$lib/components/Dashboard/Dashboard.svelte';
	import DetailsView from '$lib/components/Details/DetailsView.svelte';import {
	getState,
	getCurrentRoutine,
	getExerciseById,
	saveData,
	pauseSequence,
	playExercise,
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
import {
	modal,
	getWorker,
	openStatModal,
	openFinishModal,
	openResetModal,
	openLightbox as openModalLightbox,
	openCreateModal,
	closeFinishModal,
	closeResetModal
} from '$lib/state/modal-store.svelte.js';

	let s = $derived(getState());

	// ============================================================
	// Exercise completion check (via effect on exerciseRemaining)
	// ============================================================
	$effect(() => {
		if (s.activeExerciseId && s.exerciseRemaining <= 0 && s.isExercisePlaying) {
			handleExerciseCompletion();
		}
	});

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

			openStatModal({
				statName: ex.statisticName,
				onSave: (val: number) => {
					const today = todayStr();
					if (!ex.statisticLogs) ex.statisticLogs = [];
					ex.statisticLogs.push({ date: today, value: val });
					saveData();
					finalizeCompletion(false);
				},
				onSkip: () => {
					finalizeCompletion(false);
				}
			});
			return;
		}

		finalizeCompletion(false);
	}

	function finalizeCompletion(_playSound: boolean) {
		const state = getState();
		const activeId = state.activeExerciseId;
		if (!activeId) return;
		const ex = getExerciseById(activeId);
		if (!ex) return;

		if (_playSound) playBellSound();

		if (ex.currentRep < ex.reps) {
			ex.currentRep++;
			setExerciseRemaining(ex.durationSec);
			ex.remainingSec = ex.durationSec;
			const w = getWorker();
			if (w) {
				w.postMessage('stop');
				w.postMessage('start');
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

			openStatModal({
				statName: ex.statisticName,
				onSave: (val: number) => {
					const today = todayStr();
					if (!ex.statisticLogs) ex.statisticLogs = [];
					ex.statisticLogs.push({ date: today, value: val });
					saveData();
					forceFinishDetail();
				},
				onSkip: () => {
					forceFinishDetail();
				}
			});
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

		let timeToAdd: number;
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

		const w = getWorker();
		if (w) w.postMessage('stop');

		const routine = getCurrentRoutine();
		const completedCount = routine.exercises.filter((e) => e.completed).length;
		const scheduledSec = routine.exercises.reduce((sum, e) => sum + e.durationSec * e.reps, 0);

		const summary = {
			exercises: completedCount,
			scheduledSec,
			elapsedSec: state.sessionStartedAt
				? Math.round((Date.now() - state.sessionStartedAt) / 1000)
				: 0,
			startedAt: state.sessionStartedAt ? new Date(state.sessionStartedAt).toISOString() : null,
			completedAt: new Date().toISOString()
		};

		openFinishModal(summary, acceptFinish, cancelFinish);
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
				scheduledSec: modal.finishModalSummary?.scheduledSec || 0,
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

		closeFinishModal();
	}

	function cancelFinish() {
		closeFinishModal();
	}

	// ============================================================
	// Reset routine flow
	// ============================================================
	function handleReset() {
		pauseSequence();
		const w = getWorker();
		if (w) w.postMessage('stop');
		openResetModal(confirmReset, cancelReset);
	}

	function confirmReset() {
		storeResetRoutine();
		closeResetModal();
	}

	function cancelReset() {
		closeResetModal();
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
	function onOpenLightbox(url: string) {
		openModalLightbox(url);
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
