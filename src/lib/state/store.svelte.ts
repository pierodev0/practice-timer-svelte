/**
 * Central state store with localStorage persistence.
 * Uses Svelte 5 $state runes for reactivity — no pub/sub needed.
 *
 * Usage:
 *   import { getState, saveData, loadData, getCurrentRoutine, ... } from './store.svelte.js';
 */

import { nanoid } from 'nanoid';
import { deepClone, todayStr } from './utils.js';
import { module1Routine, module2Routine, module3Routine, module4Routine, module5Routine, module6Routine, module7Routine, module8Routine, module9Routine, module10Routine, module11Routine, module12Routine } from './routines-sample.js';
import type { Exercise, Routine, Session, StatsEntry, NewExerciseForm, StateProxy } from './types.js';

const STORAGE_KEY = 'musicRoutineApp_v36_stats';

// --- Variables de estado ($state) ---
let isExercisePlaying = $state(false);
let isAudioOn = $state(false);
let bpm = $state(120);
let globalSeconds = $state(0);
let sessionStartedAt = $state<number | null>(null);
let activeExerciseId = $state<string | null>(null);
let exerciseRemaining = $state(0);
let viewingExerciseId = $state<string | null>(null);
let autoplayRoutine = $state(false);
let pendingDetailCompletion = $state(false);
let routines = $state<Routine[]>([]);
let currentRoutineId = $state('module-1');
let newExerciseForm = $state<NewExerciseForm>({ bpm: 100, min: 2, sec: 0, reps: 1 });
let stats = $state<Record<string, StatsEntry>>({});
let sessions = $state<Session[]>([]);

// --- Getters ---

/**
 * Get the current state as a read-only proxy with getters.
 * Svelte 5 tracks $state access in templates automatically.
 */
export function getState(): StateProxy {
	return {
		get isExercisePlaying() {
			return isExercisePlaying;
		},
		get isAudioOn() {
			return isAudioOn;
		},
		get bpm() {
			return bpm;
		},
		get globalSeconds() {
			return globalSeconds;
		},
		get sessionStartedAt() {
			return sessionStartedAt;
		},
		get activeExerciseId() {
			return activeExerciseId;
		},
		get exerciseRemaining() {
			return exerciseRemaining;
		},
		get viewingExerciseId() {
			return viewingExerciseId;
		},
		get autoplayRoutine() {
			return autoplayRoutine;
		},
		get pendingDetailCompletion() {
			return pendingDetailCompletion;
		},
		get routines() {
			return routines;
		},
		get currentRoutineId() {
			return currentRoutineId;
		},
		get newExerciseForm() {
			return newExerciseForm;
		},
		get stats() {
			return stats;
		},
		get sessions() {
			return sessions;
		}
	};
}

export function getCurrentRoutine(): Routine {
	if (!Array.isArray(routines)) routines = [];
	let routine = routines.find((r) => r.id === currentRoutineId);
	if (!routine) {
		console.warn('Current routine not found, resetting to first available.');
		if (routines.length > 0) {
			currentRoutineId = routines[0].id;
			routine = routines[0];
		} else {
			routine = {
				id: nanoid(),
				name: 'Rutina Recuperada',
				exercises: []
			};
			routines = [routine];
			currentRoutineId = routine.id;
		}
		saveData();
	}
	return routine;
}

export function getExerciseById(id: string): Exercise | undefined {
	return getCurrentRoutine().exercises.find((e) => e.id === id);
}

export function getVisibleExercises(): Exercise[] {
	return getCurrentRoutine().exercises.filter((e) => !e.archived);
}

export function getSessions(options?: {
	startDate?: string;
	endDate?: string;
	routineId?: string;
}): Session[] {
	let filtered = sessions.filter(() => true);
	if (options?.startDate) filtered = filtered.filter((s) => s.date >= options.startDate!);
	if (options?.endDate) filtered = filtered.filter((s) => s.date <= options.endDate!);
	if (options?.routineId) filtered = filtered.filter((s) => s.routineId === options.routineId!);
	return filtered.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

// --- State mutations ---

/**
 * Set the active exercise ID (needed for play/pause flow).
 */
export function setActiveExerciseId(id: string | null): void {
	activeExerciseId = id;
}

/**
 * Set the remaining seconds for the active exercise.
 */
export function setExerciseRemaining(sec: number): void {
	exerciseRemaining = sec;
}

/**
 * Set the viewing exercise ID (for details view).
 */
export function setViewingExerciseId(id: string | null): void {
	viewingExerciseId = id;
}

export function setGlobalSeconds(val: number): void {
	globalSeconds = val;
}

export function setSessionStartedAt(val: number | null): void {
	sessionStartedAt = val;
}

export function setPendingDetailCompletion(val: boolean): void {
	pendingDetailCompletion = val;
}

export function setIsExercisePlaying(val: boolean): void {
	isExercisePlaying = val;
}

export function setAutoplayRoutine(val: boolean): void {
	autoplayRoutine = val;
}

export function setCurrentRoutineId(id: string): void {
	currentRoutineId = id;
}

export function setRoutines(val: Routine[]): void {
	routines = val;
}

export function setStats(val: Record<string, StatsEntry>): void {
	stats = val;
}

export function setSessions(val: Session[]): void {
	sessions = val;
}

/**
 * Switch to a different routine by ID.
 * Pauses any active exercise before switching.
 */
export function switchRoutine(id: string): void {
	if (isExercisePlaying) {
		pauseSequence();
	}
	currentRoutineId = id;
	saveData();
}

export function setBpm(val: number): void {
	bpm = Math.max(1, Math.min(300, val));
}

export function adjustBpm(delta: number): void {
	setBpm(bpm + delta);
	// Sync to active exercise if one is playing
	if (activeExerciseId) {
		const ex = getExerciseById(activeExerciseId);
		if (ex) ex.bpm = bpm;
	}
}

/**
 * Record practiced seconds for today's stats.
 */
export function recordProgressSeconds(seconds: number): void {
	const today = todayStr();
	if (!stats[today]) {
		stats[today] = { totalSec: 0, routines: {} };
	}
	stats[today].totalSec = Math.max(0, (stats[today].totalSec || 0) + seconds);
	const routine = getCurrentRoutine();
	if (routine) {
		if (!stats[today].routines[routine.name]) {
			stats[today].routines[routine.name] = 0;
		}
		stats[today].routines[routine.name] = Math.max(
			0,
			(stats[today].routines[routine.name] || 0) + seconds
		);
	}
}

/**
 * Add a completed routine session to the history log.
 */
export function addSession(sessionData: Omit<Session, 'id'>): void {
	const id = nanoid();
	sessions.push({
		id,
		...sessionData
	});

	const routine = routines.find((r) => r.id === sessionData.routineId);
	if (routine) {
		sessionData.exercises.forEach((sesEx) => {
			if (sesEx.statValue == null) return;
			const ex = routine.exercises.find((e) => e.id === sesEx.exerciseId);
			if (!ex || !ex.statisticLogs) return;
			const log = ex.statisticLogs.findLast(
				(l) => l.date === sessionData.date && l.value === sesEx.statValue && !l.sessionId
			);
			if (log) log.sessionId = id;
		});
	}

	saveData();
}

/**
 * Update a session's fields and keep stats in sync.
 * @returns true if session was found and updated
 */
export function updateSession(id: string, data: Partial<Session>): boolean {
	const idx = sessions.findIndex((s) => s.id === id);
	if (idx === -1) return false;

	const session = sessions[idx];
	const oldDate = session.date;

	Object.assign(session, data);

	if (data.date && data.date !== oldDate) {
		_adjustStatsForSession(oldDate, session, 'subtract');
		_adjustStatsForSession(data.date, session, 'add');

		routines.forEach((r) => {
			r.exercises.forEach((ex) => {
				if (!ex.statisticLogs) return;
				ex.statisticLogs.forEach((log) => {
					if (log.sessionId === id) {
						log.date = data.date!;
					}
				});
			});
		});
	}

	saveData();
	return true;
}

/**
 * Delete a session and remove its contribution from stats.
 * @returns true if session was found and deleted
 */
export function deleteSession(id: string): boolean {
	const idx = sessions.findIndex((s) => s.id === id);
	if (idx === -1) return false;

	const session = sessions[idx];
	_adjustStatsForSession(session.date, session, 'subtract');

	sessions.splice(idx, 1);

	routines.forEach((r) => {
		r.exercises.forEach((ex) => {
			if (!ex.statisticLogs) return;
			ex.statisticLogs.forEach((log) => {
				if (log.sessionId === id) log.sessionId = undefined;
			});
		});
	});

	saveData();
	return true;
}

/**
 * Add or subtract a session's duration from a stats date entry.
 */
function _adjustStatsForSession(
	dateStr: string,
	session: Session,
	operation: 'add' | 'subtract'
): void {
	const seconds = session.totalSec || 0;
	const routineName = session.routineName;

	if (operation === 'subtract') {
		if (!stats[dateStr]) return;
		stats[dateStr].totalSec = Math.max(0, (stats[dateStr].totalSec || 0) - seconds);
		if (routineName && stats[dateStr].routines) {
			stats[dateStr].routines[routineName] = Math.max(
				0,
				(stats[dateStr].routines[routineName] || 0) - seconds
			);
		}
		if (stats[dateStr].totalSec === 0) {
			delete stats[dateStr];
		}
	} else if (operation === 'add') {
		if (!stats[dateStr]) {
			stats[dateStr] = { totalSec: 0, routines: {} };
		}
		stats[dateStr].totalSec = (stats[dateStr].totalSec || 0) + seconds;
		if (routineName) {
			if (!stats[dateStr].routines) stats[dateStr].routines = {};
			stats[dateStr].routines[routineName] = (stats[dateStr].routines[routineName] || 0) + seconds;
		}
	}
}

/**
 * Reset the entire routine (completion, timers, reps).
 */
export function resetRoutine(): void {
	activeExerciseId = null;
	exerciseRemaining = 0;
	globalSeconds = 0;
	isExercisePlaying = false;
	isAudioOn = false;
	getCurrentRoutine().exercises.forEach((e) => {
		e.completed = false;
		e.remainingSec = e.durationSec;
		e.currentRep = 1;
	});
	saveData();
}

// ============================================================
// TIMER & PLAYBACK FUNCTIONS
// ============================================================

/**
 * Start playing a specific exercise by ID.
 */
export function playExercise(id: string): void {
	const ex = getExerciseById(id);
	if (!ex) return;

	// Save remaining time of previously active exercise
	if (activeExerciseId && activeExerciseId !== id) {
		const prev = getExerciseById(activeExerciseId);
		if (prev) prev.remainingSec = exerciseRemaining;
	}

	activeExerciseId = id;
	exerciseRemaining = ex.remainingSec <= 0 ? ex.durationSec : ex.remainingSec;
	setBpm(ex.bpm);
	isExercisePlaying = true;

	if (sessionStartedAt === null) {
		sessionStartedAt = Date.now();
	}

	saveData();
}

/**
 * Pause the current sequence (stop timer, audio, save state).
 */
export function pauseSequence(): void {
	if (activeExerciseId) {
		const ex = getExerciseById(activeExerciseId);
		if (ex) ex.remainingSec = exerciseRemaining;
	}
	isExercisePlaying = false;
	isAudioOn = false;

	saveData();
}

/**
 * Toggle play/pause for a specific exercise in list view.
 */
export function toggleListExercise(id: string): void {
	if (activeExerciseId === id && isExercisePlaying) {
		pauseSequence();
	} else {
		playExercise(id);
	}
}

/**
 * Toggle global audio-only mode (metronome on/off without affecting timer).
 */
export function toggleGlobalAudioOnly(): void {
	isAudioOn = !isAudioOn;
}

/**
 * Worker tick handler — called every second from the Web Worker.
 */
export function onWorkerTick(): void {
	if (!isExercisePlaying) return;

	globalSeconds++;

	if (activeExerciseId && exerciseRemaining > 0) {
		exerciseRemaining--;
		const ex = getExerciseById(activeExerciseId);
		if (ex) ex.remainingSec = exerciseRemaining;
	}
}

// ============================================================
// NEW EXERCISE FORM FUNCTIONS
// ============================================================

/**
 * Add a new exercise to the current routine from the form state.
 */
export function addNewExercise(title: string): void {
	const total = newExerciseForm.min * 60 + newExerciseForm.sec;
	const newExercise: Exercise = {
		id: nanoid(),
		title,
		bpm: newExerciseForm.bpm,
		durationSec: total,
		remainingSec: total,
		completed: false,
		autoStart: true,
		archived: false,
		reps: newExerciseForm.reps,
		currentRep: 1,
		statisticName: null,
		statisticLogs: [],
		comment: ''
	};

	getCurrentRoutine().exercises.push(newExercise);
	saveData();
}

export function adjustNewBPM(delta: number): void {
	newExerciseForm.bpm = Math.max(1, newExerciseForm.bpm + delta);
}

export function adjustNewReps(delta: number): void {
	newExerciseForm.reps = Math.max(1, newExerciseForm.reps + delta);
}

export function adjustNewTime(type: 'min' | 'sec', val: number): void {
	if (type === 'min') {
		newExerciseForm.min = Math.max(0, newExerciseForm.min + val);
	} else {
		newExerciseForm.sec = Math.max(0, newExerciseForm.sec + val);
	}
}

// ============================================================
// DETAILS VIEW FUNCTIONS
// ============================================================

/**
 * Close the details view by clearing viewingExerciseId.
 */
export function closeDetailsView(): void {
	viewingExerciseId = null;
}

/**
 * Update the title of the currently viewed exercise.
 */
export function updateExerciseTitle(newTitle: string): void {
	if (!viewingExerciseId) return;
	const ex = getExerciseById(viewingExerciseId);
	if (ex) {
		ex.title = newTitle;
		saveData();
	}
}

/**
 * Update the statistic name of the currently viewed exercise.
 */
export function updateDetailStatName(newVal: string): void {
	if (!viewingExerciseId) return;
	const ex = getExerciseById(viewingExerciseId);
	if (ex) {
		ex.statisticName = newVal.trim() === '' ? null : newVal;
		saveData();
	}
}

/**
 * Adjust the BPM of the currently viewed exercise by delta.
 */
export function adjustDetailBPM(delta: number): void {
	if (!viewingExerciseId) return;
	const ex = getExerciseById(viewingExerciseId);
	if (!ex) return;
	ex.bpm = Math.max(1, ex.bpm + delta);
	if (activeExerciseId === ex.id) {
		setBpm(ex.bpm);
	}
	saveData();
}

/**
 * Update the auto-start setting of the currently viewed exercise.
 */
export function updateDetailAutoStart(checked: boolean): void {
	if (!viewingExerciseId) return;
	const ex = getExerciseById(viewingExerciseId);
	if (!ex) return;
	ex.autoStart = checked;
	saveData();
}

/**
 * Adjust reps of the currently viewed exercise by delta.
 */
export function adjustDetailReps(delta: number): void {
	if (!viewingExerciseId) return;
	const ex = getExerciseById(viewingExerciseId);
	if (!ex) return;
	ex.reps = Math.max(1, ex.reps + delta);
	if (ex.currentRep > ex.reps) ex.currentRep = 1;
	saveData();
}

/**
 * Adjust time (minutes or seconds) of the currently viewed exercise.
 */
export function adjustDetailTime(type: 'min' | 'sec', val: number): void {
	if (!viewingExerciseId) return;
	const ex = getExerciseById(viewingExerciseId);
	if (!ex) return;
	let total = ex.durationSec;
	if (type === 'min') total = Math.max(0, total + val * 60);
	else total = Math.max(0, total + val);
	ex.durationSec = total;
	ex.remainingSec = total;
	saveData();
}

/**
 * Update the comment of the currently viewed exercise.
 */
export function updateComment(text: string): void {
	if (!viewingExerciseId) return;
	const ex = getExerciseById(viewingExerciseId);
	if (ex) {
		ex.comment = text;
		saveData();
	}
}

/**
 * Toggle play/pause from the details view.
 */
export function toggleDetailPlay(): void {
	if (activeExerciseId === viewingExerciseId && isExercisePlaying) {
		pauseSequence();
	} else if (viewingExerciseId) {
		playExercise(viewingExerciseId);
	}
}

/**
 * Reset the currently viewed exercise (clear completed, remaining, reps).
 */
export function resetCurrentDetailExercise(): void {
	const s = viewingExerciseId ? getExerciseById(viewingExerciseId) : null;
	if (!s) return;

	if (s.completed) {
		const d = s.durationSec;
		globalSeconds = Math.max(0, globalSeconds - d);
	}

	s.remainingSec = s.durationSec;
	s.completed = false;
	s.currentRep = 1;

	if (activeExerciseId === s.id) {
		pauseSequence();
		exerciseRemaining = s.durationSec;
	}

	saveData();
}

/**
 * Duplicate the currently viewed exercise and insert copy after it.
 */
export function duplicateExercise(): void {
	if (!viewingExerciseId) return;
	const original = getExerciseById(viewingExerciseId);
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

/**
 * Archive the currently viewed exercise.
 */
export function archiveExercise(): void {
	if (!viewingExerciseId) return;
	const ex = getExerciseById(viewingExerciseId);
	if (!ex) return;
	ex.archived = true;
	saveData();
	closeDetailsView();
}

/**
 * Delete the currently viewed exercise from the routine.
 */
export function deleteDetailExercise(): void {
	const routine = getCurrentRoutine();
	const idx = routine.exercises.findIndex((e) => e.id === viewingExerciseId);
	if (idx !== -1) {
		routine.exercises.splice(idx, 1);
		saveData();
		closeDetailsView();
	}
}

// --- Persistence ---

export function saveData(skipCloudSync?: boolean): void {
	// Sync remaining seconds from active exercise before saving
	if (activeExerciseId) {
		const ex = getExerciseById(activeExerciseId);
		if (ex) ex.remainingSec = exerciseRemaining;
	}

	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify({
			routines,
			currentRoutineId,
			stats,
			globalSeconds,
			sessionStartedAt,
			sessions
		})
	);

	if (!skipCloudSync) {
		try {
			import('../firebase/sync.js').then((m) => m.scheduleCloudSync()).catch(() => {});
		} catch {
			// Firebase not available — silent fail
		}
	}
}

export function loadData(): void {
	const data = localStorage.getItem(STORAGE_KEY);
	if (data) {
		try {
			const parsed = JSON.parse(data);
			routines = Array.isArray(parsed.routines) ? parsed.routines : [];
			currentRoutineId = parsed.currentRoutineId || 'module-1';
			stats = parsed.stats || {};
			sessions = parsed.sessions || [];
			globalSeconds = parsed.globalSeconds || 0;
			sessionStartedAt = parsed.sessionStartedAt || null;

			// Migrate / normalize routines
			routines.forEach((r) => {
				if (!r.createdAt) r.createdAt = 0;
				if (!Array.isArray(r.exercises)) r.exercises = [];

				// Migrate / normalize exercises
				r.exercises.forEach((ex) => {
					if (ex.durationSec === undefined && (ex as any).duration !== undefined) {
						ex.durationSec = (ex as any).duration * 60;
						delete (ex as any).duration;
					}
					if (ex.remainingSec === undefined) ex.remainingSec = ex.durationSec;
					ex.autoStart = ex.autoStart ?? true;
					ex.archived = ex.archived ?? false;
					ex.reps = ex.reps ?? 1;
					ex.currentRep = ex.currentRep ?? 1;
					ex.comment = ex.comment ?? '';
					ex.statisticName = ex.statisticName || null;
					ex.statisticLogs = ex.statisticLogs || [];
				});
			});
		} catch (e) {
			console.error('Error loading data', e);
		}
	}
}

/**
 * Reset all data to factory defaults (clears localStorage and restores
 * the initial state including sample routines).
 */
export function resetAllData(): void {
	localStorage.removeItem(STORAGE_KEY);

	routines = [
		deepClone(module1Routine),
		deepClone(module2Routine),
		deepClone(module3Routine),
		deepClone(module4Routine),
		deepClone(module5Routine),
		deepClone(module6Routine),
		deepClone(module7Routine),
		deepClone(module8Routine),
		deepClone(module9Routine),
		deepClone(module10Routine),
		deepClone(module11Routine),
		deepClone(module12Routine)
	];
	currentRoutineId = 'module-1';
	stats = {};
	sessions = [];
	globalSeconds = 0;
	activeExerciseId = null;
	exerciseRemaining = 0;
	isExercisePlaying = false;
	isAudioOn = false;
	bpm = 120;
	autoplayRoutine = false;
	pendingDetailCompletion = false;
	viewingExerciseId = null;
	newExerciseForm = { bpm: 100, min: 2, sec: 0, reps: 1 };

	saveData();
}

/**
 * Reset state for tests. Resets all $state variables to defaults.
 * NOT exported — this is called by the test suite via resetAllData then manually
 * clearing internal state.
 */
function __resetTestState(): void {
	resetAllData();
}
