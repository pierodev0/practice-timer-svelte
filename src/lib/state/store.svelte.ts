/**
 * Barrel re-export — keeps all imports working from `$lib/state/store.svelte.js`.
 *
 * Internal implementation is now split across domain files:
 *   state.svelte.ts   — shared $state object + getters + setters
 *   timer-ops.ts      — timer/playback functions
 *   routines-ops.ts   — routines/exercises CRUD
 *   stats-ops.ts      — stats/sessions CRUD
 *   persistence.ts    — localStorage + cloud sync
 */

// State object + getters
export {
	state,
	getState,
	getCurrentRoutine,
	getExerciseById,
	getVisibleExercises,
	getSessions,
	setActiveExerciseId,
	setExerciseRemaining,
	setViewingExerciseId,
	setGlobalSeconds,
	setSessionStartedAt,
	setPendingDetailCompletion,
	setIsExercisePlaying,
	setAutoplayRoutine,
	setCurrentRoutineId,
	setRoutines,
	setStats,
	setSessions,
	setBpm
} from './state.svelte.js';

// Timer operations
export {
	playExercise,
	pauseSequence,
	toggleListExercise,
	toggleGlobalAudioOnly,
	onWorkerTick,
	adjustBpm,
	resetRoutine,
	toggleDetailPlay,
	resetCurrentDetailExercise
} from './timer-ops.js';

// Routines operations
export {
	switchRoutine,
	adjustNewBPM,
	adjustNewReps,
	adjustNewTime,
	addNewExercise,
	closeDetailsView,
	updateExerciseTitle,
	updateDetailStatName,
	adjustDetailBPM,
	updateDetailAutoStart,
	adjustDetailReps,
	adjustDetailTime,
	updateComment,
	duplicateExercise,
	archiveExercise,
	deleteDetailExercise,
	getUsageCounts,
	getRoutineUsage,
	getSortedRoutines,
	createRoutine,
	renameRoutine,
	exportRoutine,
	duplicateRoutineById,
	deleteRoutineById,
	importRoutinesFromJson
} from './routines-ops.js';

// Stats operations
export {
	recordProgressSeconds,
	addSession,
	updateSession,
	deleteSession,
	calcTotalSeconds,
	calcHoursMinutes,
	calcPracticedStr,
	calcSessionsCount,
	calcAvgMinutes,
	calcStreak
} from './stats-ops.js';

// Persistence
export { saveData, loadData, resetAllData } from './persistence.js';

// Practice flow
export {
	openDetailsView,
	handleExerciseCompletion,
	finalizeCompletion,
	completeDetailExercise,
	forceFinishDetail,
	handleFinish,
	acceptFinish,
	cancelFinish,
	handleReset,
	confirmReset,
	cancelReset
} from './practice-ops.js';

// Backup & Restore
export {
	showArchivedExercises,
	exportAllData,
	deleteAllData
} from './backup-ops.js';
