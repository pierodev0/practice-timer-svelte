/**
 * Shared reactive state object.
 * Uses Svelte 5 $state on an object — the same pattern as modal-store.svelte.ts.
 * All domain files import this single reactive source of truth.
 */
import type { Exercise, Routine, Session, StatsEntry, NewExerciseForm, StateProxy } from './types.js';

// ============================================================
// Reactive state (wrapped in object for safe export)
// ============================================================
export const state = $state({
	// Timer / Playback
	isExercisePlaying: false,
	isAudioOn: false,
	bpm: 120,
	globalSeconds: 0,
	sessionStartedAt: null as number | null,
	activeExerciseId: null as string | null,
	exerciseRemaining: 0,

	// Routines / Exercises
	routines: [] as Routine[],
	currentRoutineId: 'module-1',
	viewingExerciseId: null as string | null,
	autoplayRoutine: false,
	pendingDetailCompletion: false,
	newExerciseForm: { bpm: 100, min: 2, sec: 0, reps: 1 } as NewExerciseForm,

	// Stats / Sessions
	stats: {} as Record<string, StatsEntry>,
	sessions: [] as Session[]
});

// ============================================================
// Getters
// ============================================================

/**
 * Get the state object directly.
 * Since `state` is a $state proxy, property access is reactive in templates and $derived.
 */
export function getState(): StateProxy {
	return state;
}

/**
 * Get the current routine based on currentRoutineId.
 * Returns fallback empty routine if no routines are loaded yet.
 * Pure getter — no mutations, safe for $derived.
 */
export function getCurrentRoutine(): Routine {
	if (!Array.isArray(state.routines) || state.routines.length === 0) {
		return { id: '', name: '', exercises: [] };
	}
	const routine = state.routines.find((r) => r.id === state.currentRoutineId);
	if (routine) return routine;
	return state.routines[0];
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
	let filtered = state.sessions.filter(() => true);
	if (options?.startDate) filtered = filtered.filter((s) => s.date >= options.startDate!);
	if (options?.endDate) filtered = filtered.filter((s) => s.date <= options.endDate!);
	if (options?.routineId) filtered = filtered.filter((s) => s.routineId === options.routineId!);
	return filtered.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

// ============================================================
// Simple setters (for use from domain-ops and components)
// ============================================================

export function setActiveExerciseId(id: string | null): void {
	state.activeExerciseId = id;
}
export function setExerciseRemaining(sec: number): void {
	state.exerciseRemaining = sec;
}
export function setViewingExerciseId(id: string | null): void {
	state.viewingExerciseId = id;
}
export function setGlobalSeconds(val: number): void {
	state.globalSeconds = val;
}
export function setSessionStartedAt(val: number | null): void {
	state.sessionStartedAt = val;
}
export function setPendingDetailCompletion(val: boolean): void {
	state.pendingDetailCompletion = val;
}
export function setIsExercisePlaying(val: boolean): void {
	state.isExercisePlaying = val;
}
export function setAutoplayRoutine(val: boolean): void {
	state.autoplayRoutine = val;
}
export function setCurrentRoutineId(id: string): void {
	state.currentRoutineId = id;
}
export function setRoutines(val: Routine[]): void {
	state.routines = val;
}
export function setStats(val: Record<string, StatsEntry>): void {
	state.stats = val;
}
export function setSessions(val: Session[]): void {
	state.sessions = val;
}
export function setBpm(val: number): void {
	state.bpm = Math.max(1, Math.min(300, val));
}
