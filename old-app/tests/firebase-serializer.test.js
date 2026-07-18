import { describe, it, expect } from 'vitest';

import { exportSyncState, importSyncState } from '../js/firebase/serializer.js';

describe('serializer', () => {
  describe('exportSyncState', () => {
    it('extracts routines, stats, sessions, and currentRoutineId', () => {
      const state = {
        routines: [{ id: 'r1', name: 'Test' }],
        stats: { '2026-07-18': { totalSec: 100, routines: {} } },
        sessions: [{ id: 's1', date: '2026-07-18' }],
        currentRoutineId: 'r1',
        bpm: 120, // should be excluded
        isExercisePlaying: true, // should be excluded
      };

      const result = exportSyncState(state);
      expect(result).toEqual({
        routines: [{ id: 'r1', name: 'Test' }],
        stats: { '2026-07-18': { totalSec: 100, routines: {} } },
        sessions: [{ id: 's1', date: '2026-07-18' }],
        currentRoutineId: 'r1',
      });
      // Ensure transient state is not exported
      expect(result.bpm).toBeUndefined();
      expect(result.isExercisePlaying).toBeUndefined();
    });

    it('returns empty arrays for missing state fields', () => {
      const state = {};
      const result = exportSyncState(state);
      expect(result.routines).toBeUndefined();
      expect(result.stats).toBeUndefined();
      expect(result.sessions).toBeUndefined();
      expect(result.currentRoutineId).toBeUndefined();
    });
  });

  describe('importSyncState', () => {
    it('extracts data from sync payload', () => {
      const data = {
        routines: [{ id: 'r1', name: 'Test' }],
        stats: { '2026-07-18': { totalSec: 100, routines: {} } },
        sessions: [{ id: 's1' }],
        currentRoutineId: 'r1',
      };

      const result = importSyncState(data);
      expect(result).toEqual({
        routines: [{ id: 'r1', name: 'Test' }],
        stats: { '2026-07-18': { totalSec: 100, routines: {} } },
        sessions: [{ id: 's1' }],
        currentRoutineId: 'r1',
      });
    });

    it('provides safe defaults for null/undefined input', () => {
      expect(importSyncState(null)).toEqual({
        routines: [],
        stats: {},
        sessions: [],
        currentRoutineId: null,
      });

      expect(importSyncState(undefined)).toEqual({
        routines: [],
        stats: {},
        sessions: [],
        currentRoutineId: null,
      });
    });

    it('provides defaults for missing fields', () => {
      const result = importSyncState({});
      expect(result).toEqual({
        routines: [],
        stats: {},
        sessions: [],
        currentRoutineId: null,
      });
    });

    it('handles partial data', () => {
      const result = importSyncState({ routines: [{ id: 'r1' }] });
      expect(result.routines).toHaveLength(1);
      expect(result.stats).toEqual({});
      expect(result.sessions).toEqual([]);
      expect(result.currentRoutineId).toBeNull();
    });
  });
});
