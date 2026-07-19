/**
 * Routines & Exercises operations.
 * CRUD for routines/exercises + extracted helpers for the routines route.
 */
import { nanoid } from 'nanoid';
import { state, getCurrentRoutine, getExerciseById, setBpm, setAutoplayRoutine } from './state.svelte.js';
import { pauseSequence } from './timer-ops.js';
import { saveData } from './persistence.js';
import { downloadJSON, sanitizeImportedRoutine } from './utils.js';
import type { Routine, Exercise, Session } from './types.js';

// ============================================================
// SWITCH ROUTINE
// ============================================================

/**
 * Switch to a different routine by ID.
 * Pauses any active exercise before switching.
 */
export function switchRoutine(id: string): void {
	if (state.isExercisePlaying) {
		pauseSequence();
	}
	state.currentRoutineId = id;
	setAutoplayRoutine(false);
	saveData();
}

// ============================================================
// NEW EXERCISE FORM
// ============================================================

export function adjustNewBPM(delta: number): void {
	state.newExerciseForm.bpm = Math.max(1, state.newExerciseForm.bpm + delta);
}

export function adjustNewReps(delta: number): void {
	state.newExerciseForm.reps = Math.max(1, state.newExerciseForm.reps + delta);
}

export function adjustNewTime(type: 'min' | 'sec', val: number): void {
	if (type === 'min') {
		state.newExerciseForm.min = Math.max(0, state.newExerciseForm.min + val);
	} else {
		state.newExerciseForm.sec = Math.max(0, state.newExerciseForm.sec + val);
	}
}

/**
 * Add a new exercise to the current routine from the form state.
 */
export function addNewExercise(title: string): void {
	const total = state.newExerciseForm.min * 60 + state.newExerciseForm.sec;
	const newExercise: Exercise = {
		id: nanoid(),
		title,
		bpm: state.newExerciseForm.bpm,
		durationSec: total,
		remainingSec: total,
		completed: false,
		autoStart: true,
		archived: false,
		reps: state.newExerciseForm.reps,
		currentRep: 1,
		statisticName: null,
		statisticLogs: [],
		comment: ''
	};

	getCurrentRoutine().exercises.push(newExercise);
	saveData();
}

// ============================================================
// DETAILS VIEW — EXERCISE EDITING
// ============================================================

export function closeDetailsView(): void {
	state.viewingExerciseId = null;
}

export function updateExerciseTitle(newTitle: string): void {
	if (!state.viewingExerciseId) return;
	const ex = getExerciseById(state.viewingExerciseId);
	if (ex) {
		ex.title = newTitle;
		saveData();
	}
}

export function updateDetailStatName(newVal: string): void {
	if (!state.viewingExerciseId) return;
	const ex = getExerciseById(state.viewingExerciseId);
	if (ex) {
		ex.statisticName = newVal.trim() === '' ? null : newVal;
		saveData();
	}
}

export function adjustDetailBPM(delta: number): void {
	if (!state.viewingExerciseId) return;
	const ex = getExerciseById(state.viewingExerciseId);
	if (!ex) return;
	ex.bpm = Math.max(1, ex.bpm + delta);
	if (state.activeExerciseId === ex.id) {
		setBpm(ex.bpm);
	}
	saveData();
}

export function updateDetailAutoStart(checked: boolean): void {
	if (!state.viewingExerciseId) return;
	const ex = getExerciseById(state.viewingExerciseId);
	if (!ex) return;
	ex.autoStart = checked;
	saveData();
}

export function adjustDetailReps(delta: number): void {
	if (!state.viewingExerciseId) return;
	const ex = getExerciseById(state.viewingExerciseId);
	if (!ex) return;
	ex.reps = Math.max(1, ex.reps + delta);
	if (ex.currentRep > ex.reps) ex.currentRep = 1;
	saveData();
}

export function adjustDetailTime(type: 'min' | 'sec', val: number): void {
	if (!state.viewingExerciseId) return;
	const ex = getExerciseById(state.viewingExerciseId);
	if (!ex) return;
	let total = ex.durationSec;
	if (type === 'min') total = Math.max(0, total + val * 60);
	else total = Math.max(0, total + val);
	ex.durationSec = total;
	ex.remainingSec = total;
	saveData();
}

export function updateComment(text: string): void {
	if (!state.viewingExerciseId) return;
	const ex = getExerciseById(state.viewingExerciseId);
	if (ex) {
		ex.comment = text;
		saveData();
	}
}

export function duplicateExercise(): void {
	if (!state.viewingExerciseId) return;
	const original = getExerciseById(state.viewingExerciseId);
	if (!original) return;
	const copy: Exercise = JSON.parse(JSON.stringify(original));
	copy.id = nanoid();
	copy.title += ' (Copy)';
	copy.statisticLogs = [];
	copy.completed = false;
	copy.remainingSec = copy.durationSec;
	copy.currentRep = 1;
	const routine = getCurrentRoutine();
	const idx = routine.exercises.findIndex((e) => e.id === original.id);
	routine.exercises.splice(idx + 1, 0, copy);
	saveData();
	closeDetailsView();
}

export function archiveExercise(): void {
	if (!state.viewingExerciseId) return;
	const ex = getExerciseById(state.viewingExerciseId);
	if (!ex) return;
	ex.archived = true;
	saveData();
	closeDetailsView();
}

export function deleteDetailExercise(): void {
	const routine = getCurrentRoutine();
	const idx = routine.exercises.findIndex((e) => e.id === state.viewingExerciseId);
	if (idx !== -1) {
		routine.exercises.splice(idx, 1);
		saveData();
		closeDetailsView();
	}
}

// ============================================================
// Routines route — extracted helpers
// ============================================================

/**
 * Calculate usage counts for each routine from sessions.
 */
export function getUsageCounts(sessions: Session[]): Record<string, number> {
	const counts: Record<string, number> = {};
	sessions.forEach((ses) => {
		counts[ses.routineId] = (counts[ses.routineId] || 0) + 1;
	});
	return counts;
}

/**
 * Get usage count for a single routine.
 */
export function getRoutineUsage(sessions: Session[], id: string): number {
	return sessions.filter((ses) => ses.routineId === id).length;
}

/**
 * Sort routines by mode: 'created', 'alpha', or 'usage'.
 */
export function getSortedRoutines(
	routines: Routine[],
	sessions: Session[],
	sortMode: string,
	sortAsc: boolean
): Routine[] {
	const usage = getUsageCounts(sessions);
	return [...routines].sort((a, b) => {
		let cmp = 0;
		if (sortMode === 'created') {
			cmp = (a.createdAt || 0) - (b.createdAt || 0);
		} else if (sortMode === 'alpha') {
			cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
		} else if (sortMode === 'usage') {
			cmp = (usage[a.id] || 0) - (usage[b.id] || 0);
		}
		return sortAsc ? cmp : -cmp;
	});
}

// ============================================================
// Routines CRUD (for the routines route page)
// ============================================================

/**
 * Create a new Routine object with the given name.
 * Returns the object so the caller can push it to the array.
 */
export function createRoutine(name: string): Routine {
	return {
		id: nanoid(),
		name: name.trim(),
		exercises: [],
		createdAt: Date.now()
	};
}

/**
 * Rename a routine by ID.
 */
export function renameRoutine(id: string, newName: string): void {
	const r = state.routines.find((x) => x.id === id);
	if (!r) return;
	r.name = newName.trim();
	saveData();
}

/**
 * Export a single routine as a JSON file download.
 */
export function exportRoutine(id: string): void {
	const r = state.routines.find((x) => x.id === id);
	if (!r) return;
	downloadJSON(JSON.stringify(r, null, 2), `routine_${r.name.replace(/\W/g, '_')}.json`);
}

/**
 * Duplicate a routine by ID (with "(Copia)" suffix).
 */
export function duplicateRoutineById(id: string): void {
	const original = state.routines.find((x) => x.id === id);
	if (!original) return;
	const copy: Routine = JSON.parse(JSON.stringify(original));
	copy.id = nanoid();
	copy.name = original.name + ' (Copia)';
	copy.createdAt = Date.now();
	copy.exercises = original.exercises.map((ex) => ({
		...ex,
		id: nanoid(),
		completed: false,
		remainingSec: ex.durationSec,
		currentRep: 1,
		statisticLogs: []
	}));
	state.routines.push(copy);
	saveData();
}

/**
 * Delete a routine by ID.
 * Returns false if it's the last routine (cannot delete).
 */
export function deleteRoutineById(id: string): boolean {
	if (state.routines.length <= 1) return false;
	const idx = state.routines.findIndex((r) => r.id === id);
	if (idx === -1) return false;
	state.routines.splice(idx, 1);
	if (state.currentRoutineId === id) {
		state.currentRoutineId = state.routines[0].id;
	}
	saveData();
	return true;
}

/**
 * Import routines from a JSON string.
 * Returns a human-readable result message on success.
 * Throws on invalid JSON.
 */
export function importRoutinesFromJson(jsonStr: string): string {
	const json = JSON.parse(jsonStr);
	const toAdd = (Array.isArray(json) ? json : [json]).map((r: Record<string, unknown>) => ({
		...sanitizeImportedRoutine(r),
		createdAt: (r.createdAt as number) || Date.now()
	}));
	state.routines.push(...(toAdd as Routine[]));
	saveData();
	return `Importada(s) ${toAdd.length} rutina(s).`;
}
