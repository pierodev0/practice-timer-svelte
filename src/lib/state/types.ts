// === Exercise ===
export interface Exercise {
	id: string;
	title: string;
	bpm: number;
	durationSec: number;
	remainingSec: number;
	completed: boolean;
	autoStart: boolean;
	archived: boolean;
	reps: number;
	currentRep: number;
	comment: string;
	statisticName: string | null;
	statisticLogs: StatLog[];
}

// === StatLog ===
export interface StatLog {
	date: string;
	value: number;
	sessionId?: string;
}

// === Routine ===
export interface Routine {
	id: string;
	name: string;
	exercises: Exercise[];
	createdAt?: number;
}

// === Session (History) ===
export interface Session {
	id: string;
	date: string;
	routineId: string;
	routineName: string;
	startedAt: string;
	completedAt: string;
	scheduledSec: number;
	totalSec: number;
	elapsedSec: number;
	exercises: SessionExercise[];
}

// === SessionExercise ===
export interface SessionExercise {
	exerciseId: string;
	title: string;
	bpm: number;
	durationSec: number;
	statName: string | null;
	statValue: number | null;
	repsCompleted: number;
	comment: string;
}

// === StatsEntry (diario) ===
export interface StatsEntry {
	totalSec: number;
	routines: Record<string, number>;
}

// === NewExerciseForm (formulario modal) ===
export interface NewExerciseForm {
	bpm: number;
	min: number;
	sec: number;
	reps: number;
}

// === SyncPayload (Firestore) ===
export interface SyncPayload {
	routines: Routine[];
	stats: Record<string, StatsEntry>;
	sessions: Session[];
	currentRoutineId: string | null;
}

// === BackupMeta (lista de backups) ===
export interface BackupMeta {
	id: string;
	label: string;
	createdAt: number;
}

// === StateProxy (getState return) ===
export interface StateProxy {
	readonly isExercisePlaying: boolean;
	readonly isAudioOn: boolean;
	readonly bpm: number;
	readonly globalSeconds: number;
	readonly sessionStartedAt: number | null;
	readonly activeExerciseId: string | null;
	readonly exerciseRemaining: number;
	readonly viewingExerciseId: string | null;
	readonly autoplayRoutine: boolean;
	readonly pendingDetailCompletion: boolean;
	readonly routines: Routine[];
	readonly currentRoutineId: string;
	readonly newExerciseForm: NewExerciseForm;
	readonly stats: Record<string, StatsEntry>;
	readonly sessions: Session[];
}
