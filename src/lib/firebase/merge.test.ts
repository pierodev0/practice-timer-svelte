import { describe, it, expect } from 'vitest';
import { mergeState } from './merge.js';

describe('mergeState', () => {
	it('returns cloud data when local is null', () => {
		const cloud = {
			updatedAt: 2000,
			data: { routines: [{ id: 'r1', name: 'Cloud', exercises: [] }], stats: {}, sessions: [], currentRoutineId: 'r1' }
		};
		const result = mergeState(null, cloud);
		expect(result.changed).toBe(true);
		expect(result.data?.routines[0].name).toBe('Cloud');
	});

	it('returns no change when cloud is null', () => {
		const local = { _syncedAt: 1000, data: { routines: [], stats: {}, sessions: [], currentRoutineId: null } };
		const result = mergeState(local, null);
		expect(result.changed).toBe(false);
		expect(result.data).toBeNull();
	});

	it('returns no change when both are null', () => {
		const result = mergeState(null, null);
		expect(result.changed).toBe(false);
		expect(result.data).toBeNull();
	});

	it('cloud wins when local._syncedAt is 0 (never synced)', () => {
		const local = { _syncedAt: 0, data: { routines: [], stats: {}, sessions: [], currentRoutineId: null } };
		const cloud = {
			updatedAt: 5000,
			data: { routines: [{ id: 'r1', name: 'Cloud', exercises: [] }], stats: {}, sessions: [], currentRoutineId: 'r1' }
		};
		const result = mergeState(local, cloud);
		expect(result.changed).toBe(true);
		expect(result.data?.routines[0].name).toBe('Cloud');
	});

	it('cloud wins when cloudTime > localTime', () => {
		const local = { _syncedAt: 1000, data: { routines: [{ id: 'r1', name: 'Local', exercises: [] }], stats: {}, sessions: [], currentRoutineId: 'r1' } };
		const cloud = {
			updatedAt: 2000,
			data: { routines: [{ id: 'r1', name: 'Cloud', exercises: [] }], stats: {}, sessions: [], currentRoutineId: 'r1' }
		};
		const result = mergeState(local, cloud);
		expect(result.changed).toBe(true);
		expect(result.data?.routines[0].name).toBe('Cloud');
	});

	it('local wins when localTime > cloudTime', () => {
		const local = { _syncedAt: 2000, data: { routines: [{ id: 'r1', name: 'Local', exercises: [] }], stats: {}, sessions: [], currentRoutineId: 'r1' } };
		const cloud = {
			updatedAt: 1000,
			data: { routines: [{ id: 'r1', name: 'Cloud', exercises: [] }], stats: {}, sessions: [], currentRoutineId: 'r1' }
		};
		const result = mergeState(local, cloud);
		expect(result.changed).toBe(false);
		expect(result.data).toBeNull();
	});

	it('local wins when times are equal', () => {
		const local = { _syncedAt: 1500, data: { routines: [{ id: 'r1', name: 'Local', exercises: [] }], stats: {}, sessions: [], currentRoutineId: 'r1' } };
		const cloud = {
			updatedAt: 1500,
			data: { routines: [{ id: 'r1', name: 'Cloud', exercises: [] }], stats: {}, sessions: [], currentRoutineId: 'r1' }
		};
		const result = mergeState(local, cloud);
		expect(result.changed).toBe(false);
		expect(result.data).toBeNull();
	});

	it('handles Firestore Timestamp with toMillis', () => {
		const local = { _syncedAt: 1000, data: { routines: [], stats: {}, sessions: [], currentRoutineId: null } };
		const cloud = {
			updatedAt: { toMillis: () => 2000 },
			data: { routines: [{ id: 'r1', name: 'Cloud', exercises: [] }], stats: {}, sessions: [], currentRoutineId: 'r1' }
		};
		const result = mergeState(local, cloud);
		expect(result.changed).toBe(true);
	});

	it('returns a deep clone of the winning data', () => {
		const local = { _syncedAt: 0, data: { routines: [], stats: {}, sessions: [], currentRoutineId: null } };
		const cloud: any = {
			updatedAt: 5000,
			data: { routines: [{ id: 'r1', name: 'DeepClone', exercises: [{ id: 'e1', title: 'Ex' }] }], stats: {}, sessions: [], currentRoutineId: 'r1' }
		};
		const result = mergeState(local, cloud);
		// Mutating the result should not affect original
		if (result.data) {
			result.data.routines[0].exercises[0].title = 'Mutated';
		}
		expect(cloud.data.routines[0].exercises[0].title).toBe('Ex');
	});
});
