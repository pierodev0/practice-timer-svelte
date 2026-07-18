/**
 * Stats & Sessions operations.
 * CRUD for sessions/stats + extracted calculation helpers for the stats route.
 */
import { nanoid } from 'nanoid';
import { state, getCurrentRoutine } from './state.svelte.js';
import { saveData } from './persistence.js';
import { todayStr, formatDate } from './utils.js';
import { subDays, differenceInCalendarDays } from 'date-fns';
import type { Session, StatsEntry } from './types.js';

// ============================================================
// RECORD PROGRESS
// ============================================================

/**
 * Record practiced seconds for today's stats.
 */
export function recordProgressSeconds(seconds: number): void {
	const today = todayStr();
	if (!state.stats[today]) {
		state.stats[today] = { totalSec: 0, routines: {} };
	}
	state.stats[today].totalSec = Math.max(0, (state.stats[today].totalSec || 0) + seconds);
	const routine = getCurrentRoutine();
	if (routine) {
		if (!state.stats[today].routines[routine.name]) {
			state.stats[today].routines[routine.name] = 0;
		}
		state.stats[today].routines[routine.name] = Math.max(
			0,
			(state.stats[today].routines[routine.name] || 0) + seconds
		);
	}
}

// ============================================================
// SESSION CRUD
// ============================================================

/**
 * Add a completed routine session to the history log.
 */
export function addSession(sessionData: Omit<Session, 'id'>): void {
	const id = nanoid();
	state.sessions.push({
		id,
		...sessionData
	});

	const routine = state.routines.find((r) => r.id === sessionData.routineId);
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
 */
export function updateSession(id: string, data: Partial<Session>): boolean {
	const idx = state.sessions.findIndex((s) => s.id === id);
	if (idx === -1) return false;

	const session = state.sessions[idx];
	const oldDate = session.date;

	Object.assign(session, data);

	if (data.date && data.date !== oldDate) {
		_adjustStatsForSession(oldDate, session, 'subtract');
		_adjustStatsForSession(data.date, session, 'add');

		state.routines.forEach((r) => {
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
 */
export function deleteSession(id: string): boolean {
	const idx = state.sessions.findIndex((s) => s.id === id);
	if (idx === -1) return false;

	const session = state.sessions[idx];
	_adjustStatsForSession(session.date, session, 'subtract');

	state.sessions.splice(idx, 1);

	state.routines.forEach((r) => {
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
		if (!state.stats[dateStr]) return;
		state.stats[dateStr].totalSec = Math.max(0, (state.stats[dateStr].totalSec || 0) - seconds);
		if (routineName && state.stats[dateStr].routines) {
			state.stats[dateStr].routines[routineName] = Math.max(
				0,
				(state.stats[dateStr].routines[routineName] || 0) - seconds
			);
		}
		if (state.stats[dateStr].totalSec === 0) {
			delete state.stats[dateStr];
		}
	} else if (operation === 'add') {
		if (!state.stats[dateStr]) {
			state.stats[dateStr] = { totalSec: 0, routines: {} };
		}
		state.stats[dateStr].totalSec = (state.stats[dateStr].totalSec || 0) + seconds;
		if (routineName) {
			if (!state.stats[dateStr].routines) state.stats[dateStr].routines = {};
			state.stats[dateStr].routines[routineName] =
				(state.stats[dateStr].routines[routineName] || 0) + seconds;
		}
	}
}

// ============================================================
// Stats route — extracted calculation helpers
// ============================================================
export function calcTotalSeconds(stats: Record<string, StatsEntry>): number {
	return Object.entries(stats).reduce((acc, [, data]) => acc + (data.totalSec || 0), 0);
}

export function calcHoursMinutes(totalSec: number): { hours: number; minutes: number } {
	return {
		hours: Math.floor(totalSec / 3600),
		minutes: Math.floor((totalSec % 3600) / 60)
	};
}

export function calcPracticedStr(totalSec: number): string {
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function calcSessionsCount(stats: Record<string, StatsEntry>): number {
	return Object.keys(stats).length;
}

export function calcAvgMinutes(totalSec: number, sessionsCount: number): number {
	return sessionsCount > 0 ? Math.round(totalSec / 60 / sessionsCount) : 0;
}

export function calcStreak(stats: Record<string, StatsEntry>): number {
	const sortedDateKeys = Object.keys(stats).sort();
	if (sortedDateKeys.length === 0) return 0;
	const today = todayStr();
	const yesterdayStr = formatDate(subDays(new Date(), 1));
	const lastDateStr = sortedDateKeys[sortedDateKeys.length - 1];

	if (lastDateStr === today || lastDateStr === yesterdayStr) {
		let count = 1;
		for (let i = sortedDateKeys.length - 2; i >= 0; i--) {
			const diff = differenceInCalendarDays(
				new Date(sortedDateKeys[i + 1]),
				new Date(sortedDateKeys[i])
			);
			if (diff === 1) count++;
			else break;
		}
		return count;
	}
	return 0;
}
