/**
 * Persistence operations (localStorage + cloud sync).
 */
import { state, getExerciseById } from './state.svelte.js';
import { deepClone } from './utils.js';
import {
	module1Routine,
	module2Routine,
	module3Routine,
	module4Routine,
	module5Routine,
	module6Routine,
	module7Routine,
	module8Routine,
	module9Routine,
	module10Routine,
	module11Routine,
	module12Routine
} from './routines-sample.js';

const STORAGE_KEY = 'musicRoutineApp_v36_stats';

/**
 * Save current state to localStorage and trigger optional cloud sync.
 */
export function saveData(skipCloudSync?: boolean): void {
	// Sync remaining seconds from active exercise before saving
	if (state.activeExerciseId) {
		const ex = getExerciseById(state.activeExerciseId);
		if (ex) ex.remainingSec = state.exerciseRemaining;
	}

	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify({
			routines: state.routines,
			currentRoutineId: state.currentRoutineId,
			stats: state.stats,
			globalSeconds: state.globalSeconds,
			sessionStartedAt: state.sessionStartedAt,
			sessions: state.sessions
		})
	);

	if (!skipCloudSync) {
		try {
			import('../firebase/sync.js')
				.then((m) => m.scheduleCloudSync())
				.catch(() => {});
		} catch {
			// Firebase not available — silent fail
		}
	}
}

/**
 * Load state from localStorage.
 * Populates sample routines if no data exists.
 */
export function loadData(): void {
	const data = localStorage.getItem(STORAGE_KEY);
	if (data) {
		try {
			const parsed = JSON.parse(data);
			state.routines = Array.isArray(parsed.routines) ? parsed.routines : [];
			state.currentRoutineId = parsed.currentRoutineId || 'module-1';
			state.stats = parsed.stats || {};
			state.sessions = parsed.sessions || [];
			state.globalSeconds = parsed.globalSeconds || 0;
			state.sessionStartedAt = parsed.sessionStartedAt || null;

			// Migrate / normalize routines
			state.routines.forEach((r) => {
				if (!r.createdAt) r.createdAt = 0;
				if (!Array.isArray(r.exercises)) r.exercises = [];

				r.exercises.forEach((ex) => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const oldEx = ex as any;
					if (ex.durationSec === undefined && oldEx.duration !== undefined) {
						ex.durationSec = oldEx.duration * 60;
						delete oldEx.duration;
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

	// Ensure valid routine ID
	_ensureValidRoutineId();
}

/**
 * Ensure the current routine ID points to a valid routine.
 * If routines is empty, load sample routines as initial data.
 */
function _ensureValidRoutineId(): void {
	if (!Array.isArray(state.routines) || state.routines.length === 0) {
		state.routines = [
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
		state.currentRoutineId = 'module-1';
		saveData();
		return;
	}

	if (!state.routines.find((r) => r.id === state.currentRoutineId)) {
		console.warn('Current routine not found, resetting to first available.');
		state.currentRoutineId = state.routines[0].id;
		saveData();
	}
}

/**
 * Reset all data to factory defaults (clears localStorage and restores
 * the initial state including sample routines).
 */
export function resetAllData(): void {
	localStorage.removeItem(STORAGE_KEY);

	state.routines = [
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
	state.currentRoutineId = 'module-1';
	state.stats = {};
	state.sessions = [];
	state.globalSeconds = 0;
	state.activeExerciseId = null;
	state.exerciseRemaining = 0;
	state.isExercisePlaying = false;
	state.isAudioOn = false;
	state.bpm = 120;
	state.autoplayRoutine = false;
	state.pendingDetailCompletion = false;
	state.viewingExerciseId = null;
	state.newExerciseForm = { bpm: 100, min: 2, sec: 0, reps: 1 };

	saveData();
}
