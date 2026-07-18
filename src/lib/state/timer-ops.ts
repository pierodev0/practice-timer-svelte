/**
 * Timer & Playback operations.
 * Each function operates on the shared `state` object (imported from state.svelte.ts).
 */
import { state, getExerciseById, getCurrentRoutine, setBpm } from './state.svelte.js';
import { saveData } from './persistence.js';

// ============================================================
// TIMER & PLAYBACK
// ============================================================

/**
 * Start playing a specific exercise by ID.
 */
export function playExercise(id: string): void {
	const ex = getExerciseById(id);
	if (!ex) return;

	// Save remaining time of previously active exercise
	if (state.activeExerciseId && state.activeExerciseId !== id) {
		const prev = getExerciseById(state.activeExerciseId);
		if (prev) prev.remainingSec = state.exerciseRemaining;
	}

	state.activeExerciseId = id;
	state.exerciseRemaining = ex.remainingSec <= 0 ? ex.durationSec : ex.remainingSec;
	setBpm(ex.bpm);
	state.isExercisePlaying = true;

	if (state.sessionStartedAt === null) {
		state.sessionStartedAt = Date.now();
	}

	saveData();
}

/**
 * Pause the current sequence (stop timer, audio, save state).
 */
export function pauseSequence(): void {
	if (state.activeExerciseId) {
		const ex = getExerciseById(state.activeExerciseId);
		if (ex) ex.remainingSec = state.exerciseRemaining;
	}
	state.isExercisePlaying = false;
	state.isAudioOn = false;

	saveData();
}

/**
 * Toggle play/pause for a specific exercise in list view.
 */
export function toggleListExercise(id: string): void {
	if (state.activeExerciseId === id && state.isExercisePlaying) {
		pauseSequence();
	} else {
		playExercise(id);
	}
}

/**
 * Toggle global audio-only mode (metronome on/off without affecting timer).
 */
export function toggleGlobalAudioOnly(): void {
	state.isAudioOn = !state.isAudioOn;
}

/**
 * Worker tick handler — called every second from the Web Worker.
 */
export function onWorkerTick(): void {
	if (!state.isExercisePlaying) return;

	state.globalSeconds++;

	if (state.activeExerciseId && state.exerciseRemaining > 0) {
		state.exerciseRemaining--;
		const ex = getExerciseById(state.activeExerciseId);
		if (ex) ex.remainingSec = state.exerciseRemaining;
	}
}

export function adjustBpm(delta: number): void {
	setBpm(state.bpm + delta);
	// Sync to active exercise if one is playing
	if (state.activeExerciseId) {
		const ex = getExerciseById(state.activeExerciseId);
		if (ex) ex.bpm = state.bpm;
	}
}

/**
 * Reset the entire routine (completion, timers, reps).
 */
export function resetRoutine(): void {
	state.activeExerciseId = null;
	state.exerciseRemaining = 0;
	state.globalSeconds = 0;
	state.isExercisePlaying = false;
	state.isAudioOn = false;

	const routine = getCurrentRoutine();
	if (routine) {
		routine.exercises.forEach((e) => {
			e.completed = false;
			e.remainingSec = e.durationSec;
			e.currentRep = 1;
		});
	}

	saveData();
}

// ============================================================
// DETAILS VIEW TIMER FUNCTIONS
// ============================================================

/**
 * Toggle play/pause from the details view.
 */
export function toggleDetailPlay(): void {
	if (state.activeExerciseId === state.viewingExerciseId && state.isExercisePlaying) {
		pauseSequence();
	} else if (state.viewingExerciseId) {
		playExercise(state.viewingExerciseId);
	}
}

/**
 * Reset the currently viewed exercise (clear completed, remaining, reps).
 */
export function resetCurrentDetailExercise(): void {
	const ex = state.viewingExerciseId ? getExerciseById(state.viewingExerciseId) : null;
	if (!ex) return;

	if (ex.completed) {
		state.globalSeconds = Math.max(0, state.globalSeconds - ex.durationSec);
	}

	ex.remainingSec = ex.durationSec;
	ex.completed = false;
	ex.currentRep = 1;

	if (state.activeExerciseId === ex.id) {
		pauseSequence();
		state.exerciseRemaining = ex.durationSec;
	}

	saveData();
}
