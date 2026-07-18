/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { exportSyncState, importSyncState } from './serializer.js';
import type { Routine, Session, StatsEntry } from '../state/types.js';

describe('serializer', () => {
	describe('exportSyncState', () => {
		it('extracts routines, stats, sessions, currentRoutineId from state', () => {
			const routines: Routine[] = [
				{ id: 'r1', name: 'R1', exercises: [] }
			];
			const stats: Record<string, StatsEntry> = {
				'2026-07-18': { totalSec: 300, routines: { R1: 300 } }
			};
			const sessions: Session[] = [
				{
					id: 's1',
					date: '2026-07-18',
					routineId: 'r1',
					routineName: 'R1',
					startedAt: '2026-07-18T10:00:00Z',
					completedAt: '2026-07-18T10:30:00Z',
					scheduledSec: 600,
					totalSec: 300,
					elapsedSec: 300,
					exercises: []
				}
			];

			const result = exportSyncState({
				routines,
				stats,
				sessions,
				currentRoutineId: 'r1',
				bpm: 120,
				isExercisePlaying: false
			} as any);

			expect(result.routines).toBe(routines);
			expect(result.stats).toBe(stats);
			expect(result.sessions).toBe(sessions);
			expect(result.currentRoutineId).toBe('r1');
		});

		it('excludes transient flags like bpm and isExercisePlaying', () => {
			const result = exportSyncState({
				routines: [],
				stats: {},
				sessions: [],
				currentRoutineId: null,
				bpm: 120,
				isExercisePlaying: true,
				isAudioOn: false
			} as any);

			expect(result).not.toHaveProperty('bpm');
			expect(result).not.toHaveProperty('isExercisePlaying');
			expect(result).not.toHaveProperty('isAudioOn');
		});

		it('handles empty state gracefully', () => {
			const result = exportSyncState({
				routines: [],
				stats: {},
				sessions: [],
				currentRoutineId: null
			} as any);

			expect(result.routines).toEqual([]);
			expect(result.stats).toEqual({});
			expect(result.sessions).toEqual([]);
			expect(result.currentRoutineId).toBeNull();
		});
	});

	describe('importSyncState', () => {
		it('extracts routines, stats, sessions, currentRoutineId from data', () => {
			const data = {
				routines: [{ id: 'r1', name: 'R1', exercises: [] }],
				stats: { '2026-07-18': { totalSec: 300, routines: {} } },
				sessions: [{ id: 's1', date: '2026-07-18', totalSec: 300 }],
				currentRoutineId: 'r1'
			};

			const result = importSyncState(data);

			expect(result.routines).toHaveLength(1);
			expect(result.routines[0].name).toBe('R1');
			expect(result.stats['2026-07-18'].totalSec).toBe(300);
			expect(result.sessions).toHaveLength(1);
			expect(result.currentRoutineId).toBe('r1');
		});

		it('provides safe defaults for null/undefined data', () => {
			const result = importSyncState(null);

			expect(result.routines).toEqual([]);
			expect(result.stats).toEqual({});
			expect(result.sessions).toEqual([]);
			expect(result.currentRoutineId).toBeNull();
		});

		it('provides safe defaults for undefined data', () => {
			const result = importSyncState(undefined);

			expect(result.routines).toEqual([]);
			expect(result.stats).toEqual({});
			expect(result.sessions).toEqual([]);
			expect(result.currentRoutineId).toBeNull();
		});

		it('provides defaults for missing fields in partial data', () => {
			const result = importSyncState({ routines: [{ id: 'r1' }] });

			expect(result.routines).toHaveLength(1);
			expect(result.stats).toEqual({});
			expect(result.sessions).toEqual([]);
			expect(result.currentRoutineId).toBeNull();
		});
	});
});
