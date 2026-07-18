import type { Routine, Session, StatsEntry } from '../state/types.js';

export interface SyncPayload {
	routines: Routine[];
	stats: Record<string, StatsEntry>;
	sessions: Session[];
	currentRoutineId: string | null;
}

/**
 * Extract syncable data from full application state.
 * Excludes transient flags (bpm, isExercisePlaying, etc.).
 */
export function exportSyncState(state: {
	routines: Routine[];
	stats: Record<string, StatsEntry>;
	sessions: Session[];
	currentRoutineId: string | null;
}): SyncPayload {
	return {
		routines: state.routines,
		stats: state.stats,
		sessions: state.sessions,
		currentRoutineId: state.currentRoutineId
	};
}

/**
 * Deserialize Firestore data back to SyncPayload with safe defaults.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function importSyncState(data: any): SyncPayload {
	return {
		routines: data?.routines || [],
		stats: data?.stats || {},
		sessions: data?.sessions || [],
		currentRoutineId: data?.currentRoutineId || null
	};
}
