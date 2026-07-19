/**
 * Practice flow operations.
 *
 * Encapsulates all logic for the practice session lifecycle:
 * exercise completion, routine finish, reset, and detail-view completion.
 *
 * Each function reads/writes the shared $state object and coordinates
 * timer, persistence, modal, and audio modules — components only call these.
 */
import {
	getState,
	getCurrentRoutine,
	getExerciseById,
	setViewingExerciseId,
	setActiveExerciseId,
	setExerciseRemaining,
	setGlobalSeconds,
	setSessionStartedAt,
	setPendingDetailCompletion
} from './state.svelte.js';
import { pauseSequence, playExercise, resetRoutine } from './timer-ops.js';
import { saveData } from './persistence.js';
import { addSession, recordProgressSeconds } from './stats-ops.js';
import { todayStr } from './utils.js';
import { playBellSound } from '../audio.js';
import {
	modal,
	getWorker,
	openStatModal,
	openFinishModal,
	openResetModal,
	closeFinishModal,
	closeResetModal
} from './modal-store.svelte.js';

// ============================================================
// Details view navigation
// ============================================================

export function openDetailsView(id: string): void {
	setViewingExerciseId(id);
}

// ============================================================
// Exercise completion (triggered by timer expiry)
// ============================================================

export function handleExerciseCompletion(): void {
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

// ============================================================
// Finalize completion (advance rep or complete exercise)
// ============================================================

export function finalizeCompletion(_playSound: boolean): void {
	const state = getState();
	const activeId = state.activeExerciseId;
	if (!activeId) return;

	const ex = getExerciseById(activeId);
	if (!ex) return;

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
// Detail-view completion
// ============================================================

export function completeDetailExercise(): void {
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

export function forceFinishDetail(): void {
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
// Routine finish flow
// ============================================================

export function handleFinish(): void {
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

export function acceptFinish(): void {
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

export function cancelFinish(): void {
	closeFinishModal();
}

// ============================================================
// Routine reset flow
// ============================================================

export function handleReset(): void {
	pauseSequence();
	const w = getWorker();
	if (w) w.postMessage('stop');
	openResetModal(confirmReset, cancelReset);
}

export function confirmReset(): void {
	resetRoutine();
	closeResetModal();
}

export function cancelReset(): void {
	closeResetModal();
}
