import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks hoisted — persist across resetModules
vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid' }));
vi.mock('date-fns', () => ({
  format: (date, fmt) => {
    if (fmt === 'yyyy-MM-dd') return '2026-07-18';
    return String(date);
  },
}));

describe('state.js', () => {
  let state;
  let localStorageMock;

  beforeEach(async () => {
    vi.resetModules();

    const store = {};
    localStorageMock = {
      getItem: vi.fn((key) => store[key] ?? null),
      setItem: vi.fn((key, val) => { store[key] = val; }),
      removeItem: vi.fn((key) => { delete store[key]; }),
    };
    vi.stubGlobal('localStorage', localStorageMock);

    state = await import('../js/state.js');

    // Reset state & clear mock counts
    try { state.resetAllData(); } catch (_) {}
    localStorageMock.setItem.mockClear();
    localStorageMock.getItem.mockClear();
  });

  // ============================================================
  // subscribe / getState
  // ============================================================
  describe('subscribe and getState', () => {
    it('getState returns the state object', () => {
      const s = state.getState();
      expect(s).toBeDefined();
      expect(Array.isArray(s.routines)).toBe(true);
      expect(s.currentRoutineId).toBe('module-1');
      expect(s.bpm).toBe(120);
    });

    it('subscribe calls callback on saveData', () => {
      const cb = vi.fn();
      state.subscribe(cb);
      state.saveData(true);
      expect(cb).toHaveBeenCalledOnce();
    });

    it('subscribe returns an unsubscribe function', () => {
      const cb = vi.fn();
      const unsub = state.subscribe(cb);
      unsub();
      state.saveData(true);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // saveData / loadData
  // ============================================================
  describe('saveData and loadData', () => {
    it('saveData persists routines to localStorage', () => {
      state.saveData(true);
      expect(localStorageMock.setItem).toHaveBeenCalledOnce();

      const [key, json] = localStorageMock.setItem.mock.calls[0];
      expect(key).toMatch(/musicRoutineApp/);
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed.routines)).toBe(true);
      expect(parsed.currentRoutineId).toBe('module-1');
    });

    it('saveData syncs remainingSec from active exercise before saving', () => {
      const s = state.getState();
      s.activeExerciseId = s.routines[0].exercises[0].id;
      s.exerciseRemaining = 42;
      state.saveData(true);

      const [, json] = localStorageMock.setItem.mock.calls[0];
      expect(JSON.parse(json).routines[0].exercises[0].remainingSec).toBe(42);
    });

    it('loadData restores saved state', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        routines: [{ id: 'r1', name: 'Test', exercises: [] }],
        currentRoutineId: 'r1',
        stats: { '2026-07-18': { totalSec: 100, routines: {} } },
        sessions: [{ id: 's1', date: '2026-07-18', totalSec: 100 }],
        globalSeconds: 50,
        sessionStartedAt: null,
      }));

      state.loadData();
      const s = state.getState();
      expect(s.routines).toHaveLength(1);
      expect(s.routines[0].name).toBe('Test');
      expect(s.currentRoutineId).toBe('r1');
      expect(s.stats['2026-07-18'].totalSec).toBe(100);
      expect(s.globalSeconds).toBe(50);
    });

    it('loadData handles missing localStorage gracefully', () => {
      state.loadData();
      expect(state.getState().routines.length).toBeGreaterThan(0);
      expect(state.getState().currentRoutineId).toBe('module-1');
    });

    it('loadData normalizes legacy exercise fields', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        routines: [{
          id: 'r1', name: 'Legacy',
          exercises: [{ title: 'Old', duration: 3 }],
        }],
        currentRoutineId: 'r1', stats: {}, sessions: [],
      }));

      state.loadData();
      const ex = state.getState().routines[0].exercises[0];
      expect(ex.durationSec).toBe(180);
      expect(ex.duration).toBeUndefined();
      expect(ex.remainingSec).toBe(180);
      expect(ex.autoStart).toBe(true);
      expect(ex.archived).toBe(false);
      expect(ex.reps).toBe(1);
      expect(ex.currentRep).toBe(1);
      expect(ex.comment).toBe('');
      expect(ex.statisticName).toBeNull();
      expect(ex.statisticLogs).toEqual([]);
    });
  });

  // ============================================================
  // getCurrentRoutine
  // ============================================================
  describe('getCurrentRoutine', () => {
    it('returns the routine matching currentRoutineId', () => {
      const r = state.getCurrentRoutine();
      expect(r.id).toBe('module-1');
      expect(r.name).toBe('Module 1');
    });

    it('falls back to first routine if current is not found', () => {
      const s = state.getState();
      s.currentRoutineId = 'nonexistent';
      expect(state.getCurrentRoutine().id).toBe(s.routines[0].id);
    });

    it('creates a recovered routine if routines array is empty', () => {
      const s = state.getState();
      s.routines.splice(0, s.routines.length);
      s.currentRoutineId = 'whatever';
      const r = state.getCurrentRoutine();
      expect(r.name).toBe('Rutina Recuperada');
      expect(s.routines).toHaveLength(1);
    });
  });

  // ============================================================
  // getExerciseById
  // ============================================================
  describe('getExerciseById', () => {
    it('returns exercise by ID', () => {
      const s = state.getState();
      const ex = s.routines[0].exercises[0];
      expect(state.getExerciseById(ex.id)).toBe(ex);
    });

    it('returns undefined for non-existent exercise', () => {
      expect(state.getExerciseById('no-such-id')).toBeUndefined();
    });
  });

  // ============================================================
  // getVisibleExercises
  // ============================================================
  describe('getVisibleExercises', () => {
    it('filters out archived exercises', () => {
      const s = state.getState();
      const routine = state.getCurrentRoutine();
      const exercises = routine.exercises;
      const ex = exercises[1]; // second exercise (0-indexed)

      expect(ex.archived).toBe(false);
      ex.archived = true;
      expect(ex.archived).toBe(true);

      const visible = state.getVisibleExercises();

      // Cannot use .id to search because ALL share mocked nanoid 'test-nanoid'
      expect(visible).toHaveLength(exercises.length - 1);
      expect(visible.includes(ex)).toBe(false);
      expect(visible.includes(exercises[0])).toBe(true);
    });

    it('returns only non-archived exercises', () => {
      const visible = state.getVisibleExercises();
      visible.forEach(ex => expect(ex.archived).toBe(false));
    });
  });

  // ============================================================
  // setBpm / adjustBpm
  // ============================================================
  describe('setBpm and adjustBpm', () => {
    it('setBpm sets the BPM', () => {
      state.setBpm(140);
      expect(state.getState().bpm).toBe(140);
    });

    it('setBpm clamps to min 1', () => {
      state.setBpm(0);
      expect(state.getState().bpm).toBe(1);
    });

    it('setBpm clamps to max 300', () => {
      state.setBpm(999);
      expect(state.getState().bpm).toBe(300);
    });

    it('adjustBpm adds delta', () => {
      state.getState().bpm = 120;
      state.adjustBpm(10);
      expect(state.getState().bpm).toBe(130);
    });

    it('adjustBpm subtracts delta', () => {
      state.getState().bpm = 120;
      state.adjustBpm(-20);
      expect(state.getState().bpm).toBe(100);
    });

    it('adjustBpm syncs to active exercise', () => {
      const s = state.getState();
      const ex = s.routines[0].exercises[0];
      s.bpm = 100;
      s.activeExerciseId = ex.id;
      ex.bpm = 60;
      state.adjustBpm(20);
      expect(s.bpm).toBe(120);
      expect(ex.bpm).toBe(120);
    });
  });

  // ============================================================
  // recordProgressSeconds
  // ============================================================
  describe('recordProgressSeconds', () => {
    it('records seconds for today', () => {
      state.recordProgressSeconds(300);
      expect(state.getState().stats['2026-07-18'].totalSec).toBe(300);
    });

    it('accumulates across calls', () => {
      state.recordProgressSeconds(100);
      state.recordProgressSeconds(200);
      expect(state.getState().stats['2026-07-18'].totalSec).toBe(300);
    });

    it('records per-routine breakdown', () => {
      state.recordProgressSeconds(150);
      const s = state.getState();
      expect(s.stats['2026-07-18'].routines[s.routines[0].name]).toBe(150);
    });
  });

  // ============================================================
  // addSession / getSessions
  // ============================================================
  describe('addSession and getSessions', () => {
    function mk(date, completedAt) {
      return { date, routineId: 'module-1', routineName: 'Module 1',
        totalSec: 1200, completedAt, exercises: [] };
    }

    it('adds a session with generated ID', () => {
      state.addSession(mk('2026-07-18', '2026-07-18T10:30:00Z'));
      const sessions = state.getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('test-nanoid');
    });

    it('sorts sessions newest first', () => {
      state.addSession(mk('2026-07-17', '2026-07-17T10:00:00Z'));
      state.addSession(mk('2026-07-19', '2026-07-19T10:00:00Z'));
      state.addSession(mk('2026-07-18', '2026-07-18T10:00:00Z'));
      const all = state.getSessions();
      expect(all).toHaveLength(3);
      expect(all[0].completedAt).toBe('2026-07-19T10:00:00Z');
      expect(all[2].completedAt).toBe('2026-07-17T10:00:00Z');
    });

    it('filters by startDate', () => {
      state.addSession(mk('2026-07-18', '2026-07-18T10:00:00Z'));
      state.addSession(mk('2026-07-20', '2026-07-20T10:00:00Z'));
      expect(state.getSessions({ startDate: '2026-07-19' })).toHaveLength(1);
    });

    it('filters by endDate', () => {
      state.addSession(mk('2026-07-18', '2026-07-18T10:00:00Z'));
      state.addSession(mk('2026-07-20', '2026-07-20T10:00:00Z'));
      expect(state.getSessions({ endDate: '2026-07-19' })).toHaveLength(1);
    });

    it('filters by routineId', () => {
      state.addSession(mk('2026-07-18', '2026-07-18T10:00:00Z'));
      state.addSession({ ...mk('2026-07-18', '2026-07-18T12:00:00Z'),
        routineId: 'module-2', routineName: 'Module 2' });
      expect(state.getSessions({ routineId: 'module-2' })).toHaveLength(1);
    });
  });

  // ============================================================
  // updateSession
  // ============================================================
  describe('updateSession', () => {
    it('updates session fields', () => {
      state.addSession({ date: '2026-07-18', routineId: 'm1', routineName: 'M1',
        totalSec: 1200, completedAt: '2026-07-18T10:00:00Z', exercises: [] });

      expect(state.updateSession('test-nanoid', { routineName: 'Updated' })).toBe(true);
      expect(state.getSessions()[0].routineName).toBe('Updated');
    });

    it('returns false for unknown session', () => {
      expect(state.updateSession('no-such', { date: '2026-07-19' })).toBe(false);
    });
  });

  // ============================================================
  // deleteSession
  // ============================================================
  describe('deleteSession', () => {
    it('deletes a session', () => {
      state.addSession({ date: '2026-07-18', routineId: 'm1', routineName: 'M1',
        totalSec: 1200, completedAt: '2026-07-18T10:00:00Z', exercises: [] });
      expect(state.getSessions()).toHaveLength(1);
      expect(state.deleteSession('test-nanoid')).toBe(true);
      expect(state.getSessions()).toHaveLength(0);
    });

    it('returns false for unknown session', () => {
      expect(state.deleteSession('no-such')).toBe(false);
    });
  });

  // ============================================================
  // resetRoutine
  // ============================================================
  describe('resetRoutine', () => {
    it('resets all exercises in the current routine', () => {
      const s = state.getState();
      const ex = s.routines[0].exercises[0];
      ex.completed = true;
      ex.remainingSec = 0;
      ex.currentRep = 3;
      s.activeExerciseId = 'x';
      s.exerciseRemaining = 50;
      s.globalSeconds = 500;

      state.resetRoutine();

      expect(ex.completed).toBe(false);
      expect(ex.remainingSec).toBe(ex.durationSec);
      expect(ex.currentRep).toBe(1);
      expect(s.activeExerciseId).toBeNull();
      expect(s.exerciseRemaining).toBe(0);
      expect(s.globalSeconds).toBe(0);
    });
  });
});
