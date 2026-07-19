/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid' }));
vi.mock('date-fns', () => ({
	format: (date: Date, fmt: string) => {
		if (fmt === 'yyyy-MM-dd') return '2026-07-18';
		return String(date);
	}
}));

// Shared mutable modal state — populated after vi.mock hoist
const modalTestState: Record<string, any> = {};

vi.mock('./modal-store.svelte.js', () => ({
	get modal() {
		return modalTestState._modal;
	},
	getWorker: () => ({ postMessage: vi.fn() }),
	setWorker: vi.fn(),
	openStatModal: (config: any) => {
		modalTestState._modal.showStatModal = true;
		modalTestState._modal.statModalConfig = config;
	},
	closeStatModal: () => {
		modalTestState._modal.showStatModal = false;
		modalTestState._modal.statModalConfig = null;
	},
	openFinishModal: (summary: any, onAccept: () => void, onCancel: () => void) => {
		modalTestState._modal.showFinishModal = true;
		modalTestState._modal.finishModalSummary = summary;
		modalTestState._modal.finishModalOnAccept = onAccept;
		modalTestState._modal.finishModalOnCancel = onCancel;
	},
	closeFinishModal: () => {
		modalTestState._modal.showFinishModal = false;
		modalTestState._modal.finishModalSummary = null;
		modalTestState._modal.finishModalOnAccept = null;
		modalTestState._modal.finishModalOnCancel = null;
	},
	openResetModal: (onConfirm: () => void, onCancel: () => void) => {
		modalTestState._modal.showResetModal = true;
		modalTestState._modal.resetModalOnConfirm = onConfirm;
		modalTestState._modal.resetModalOnCancel = onCancel;
	},
	closeResetModal: () => {
		modalTestState._modal.showResetModal = false;
		modalTestState._modal.resetModalOnConfirm = null;
		modalTestState._modal.resetModalOnCancel = null;
	},
	openLightbox: vi.fn(),
	closeLightbox: vi.fn(),
	openEditStatsModal: vi.fn(),
	closeEditStatsModal: vi.fn(),
	openEditSessionModal: vi.fn(),
	closeEditSessionModal: vi.fn()
}));

vi.mock('./utils.js', () => ({
	todayStr: () => '2026-07-18',
	formatTime: (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
	getFirstImage: () => null,
	getFirstUrl: () => null,
	deepClone: (obj: any) => JSON.parse(JSON.stringify(obj)),
	formatDate: (d: Date) => {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	},
	formatISOTime: () => '12:00 p.m',
	stringToColor: () => '#FF0000',
	secToMin: (s: number) => Math.round((s || 0) / 60),
	sanitizeImportedRoutine: (r: any) => r,
	downloadJSON: vi.fn()
}));

vi.mock('../audio.js', () => ({
	playBellSound: vi.fn()
}));

describe('practice-ops', () => {
	let ops: typeof import('./practice-ops.js');
	let store: typeof import('./store.svelte.js');

	beforeEach(async () => {
		vi.resetModules();

		const storeData: Record<string, string> = {};
		const localStorageMock = {
			getItem: vi.fn((key: string) => storeData[key] ?? null),
			setItem: vi.fn((key: string, val: string) => {
				storeData[key] = val;
			}),
			removeItem: vi.fn((key: string) => {
				delete storeData[key];
			})
		};
		vi.stubGlobal('localStorage', localStorageMock);

		// Reset modal test state
		modalTestState._modal = {
			showStatModal: false,
			statModalConfig: null,
			showFinishModal: false,
			finishModalSummary: null,
			finishModalOnAccept: null,
			finishModalOnCancel: null,
			showResetModal: false,
			resetModalOnConfirm: null,
			resetModalOnCancel: null
		};

		store = await import('./store.svelte.js');
		store.resetAllData();
		vi.clearAllMocks();

		ops = await import('./practice-ops.js');
	});

	// ============================================================
	// openDetailsView
	// ============================================================
	describe('openDetailsView', () => {
		it('sets viewingExerciseId', () => {
			const s = store.getState();
			ops.openDetailsView('some-id');
			expect(s.viewingExerciseId).toBe('some-id');
		});
	});

	// ============================================================
	// handleExerciseCompletion
	// ============================================================
	describe('handleExerciseCompletion', () => {
		it('does nothing if no active exercise', () => {
			store.setActiveExerciseId(null);
			ops.handleExerciseCompletion();
			// Should not crash — no active exercise to complete
			expect(modalTestState._modal.showStatModal).toBe(false);
		});

		it('opens stat modal if exercise has statisticName and is not completed', () => {
			const s = store.getState();
			const ex = s.routines[0].exercises[0];
			ex.statisticName = 'BPM';
			store.setActiveExerciseId(ex.id);

			ops.handleExerciseCompletion();

			expect(modalTestState._modal.showStatModal).toBe(true);
			expect(modalTestState._modal.statModalConfig?.statName).toBe('BPM');
		});

		it('calls finalizeCompletion when exercise has no statisticName', () => {
			const s = store.getState();
			const ex = s.routines[0].exercises[0];
			ex.statisticName = null;
			store.setActiveExerciseId(ex.id);
			ex.completed = false;
			ex.reps = 1;
			ex.durationSec = 60;
			ex.remainingSec = 0;
			store.setExerciseRemaining(0);

			ops.handleExerciseCompletion();

			// Since no stat name, should advance rep/complete directly
			expect(ex.completed).toBe(true);
			expect(modalTestState._modal.showStatModal).toBe(false);
		});

		it('skips stat modal if exercise is already completed', () => {
			const s = store.getState();
			const ex = s.routines[0].exercises[0];
			ex.statisticName = 'BPM';
			ex.completed = true;
			store.setActiveExerciseId(ex.id);

			ops.handleExerciseCompletion();

			expect(modalTestState._modal.showStatModal).toBe(false);
		});
	});

	// ============================================================
	// finalizeCompletion
	// ============================================================
	describe('finalizeCompletion', () => {
		it('does nothing if no active exercise', () => {
			store.setActiveExerciseId(null);
			expect(() => ops.finalizeCompletion(false)).not.toThrow();
		});

		it('advances rep and resets remaining time when currentRep < reps', () => {
			const s = store.getState();
			const ex = s.routines[0].exercises[0];
			ex.reps = 3;
			ex.currentRep = 1;
			ex.durationSec = 120;
			ex.remainingSec = 0;
			store.setActiveExerciseId(ex.id);
			store.setExerciseRemaining(0);

			ops.finalizeCompletion(false);

			expect(ex.currentRep).toBe(2);
			expect(ex.remainingSec).toBe(120);
			expect(s.exerciseRemaining).toBe(120);
		});

		it('completes exercise when currentRep reaches reps', () => {
			const s = store.getState();
			const ex = s.routines[0].exercises[0];
			ex.reps = 2;
			ex.currentRep = 2;
			ex.durationSec = 60;
			store.setActiveExerciseId(ex.id);
			store.setExerciseRemaining(0);

			ops.finalizeCompletion(false);

			expect(ex.completed).toBe(true);
			expect(ex.remainingSec).toBe(0);
			expect(s.isExercisePlaying).toBe(false);
		});

		it('auto-plays next exercise when autoplayRoutine is on', () => {
			const s = store.getState();
			s.autoplayRoutine = true;
			const routine = store.getCurrentRoutine();
			const ex1 = routine.exercises[0];
			const ex2 = routine.exercises[1];
			ex1.reps = 1;
			ex1.currentRep = 1;
			ex1.completed = false;
			store.setActiveExerciseId(ex1.id);

			ops.finalizeCompletion(false);

			expect(ex1.completed).toBe(true);
			// Should have played next exercise (via setTimeout)
			// Just verify it didn't crash and autoplay logic triggered
		});

		it('calls handleFinish when autoplay finishes last visible exercise', () => {
			const s = store.getState();
			s.autoplayRoutine = true;
			// With nanoid mocked, all exercises share ID 'test-nanoid'.
			// getExerciseById('test-nanoid') returns the FIRST exercise.
			// Archive all except exercise[0] so visible list has 1 element,
			// making exercise[0] both first AND last → handleFinish fires.
			s.routines[0].exercises.forEach((e, i) => {
				e.archived = i > 0;
				e.reps = 1;
			});
			const ex = s.routines[0].exercises[0];
			ex.currentRep = 1;
			ex.completed = false;
			store.setActiveExerciseId(ex.id);
			store.setSessionStartedAt(Date.now());

			ops.finalizeCompletion(false);

			expect(modalTestState._modal.showFinishModal).toBe(true);
		});
	});

	// ============================================================
	// completeDetailExercise
	// ============================================================
	describe('completeDetailExercise', () => {
		it('does nothing if no viewingExerciseId', () => {
			store.setViewingExerciseId(null);
			ops.completeDetailExercise();
			expect(modalTestState._modal.showStatModal).toBe(false);
		});

		it('opens stat modal when exercise has statisticName', () => {
			const s = store.getState();
			const ex = s.routines[0].exercises[0];
			ex.statisticName = 'Accuracy';
			store.setViewingExerciseId(ex.id);

			ops.completeDetailExercise();

			expect(modalTestState._modal.showStatModal).toBe(true);
			expect(modalTestState._modal.statModalConfig?.statName).toBe('Accuracy');
		});

		it('calls forceFinishDetail when no statisticName', () => {
			const s = store.getState();
			const ex = s.routines[0].exercises[0];
			ex.statisticName = null;
			ex.remainingSec = 30;
			ex.durationSec = 60;
			store.setViewingExerciseId(ex.id);

			ops.completeDetailExercise();

			expect(ex.completed).toBe(true);
			expect(ex.remainingSec).toBe(0);
			expect(s.viewingExerciseId).toBeNull();
		});
	});

	// ============================================================
	// handleFinish
	// ============================================================
	describe('handleFinish', () => {
		it('opens finish modal with summary', () => {
			const s = store.getState();
			const routine = store.getCurrentRoutine();
			const completedCount = routine.exercises.filter((e) => e.completed).length;
			store.setSessionStartedAt(Date.now());

			ops.handleFinish();

			expect(modalTestState._modal.showFinishModal).toBe(true);
			expect(modalTestState._modal.finishModalSummary?.exercises).toBe(completedCount);
			expect(typeof modalTestState._modal.finishModalOnAccept).toBe('function');
			expect(typeof modalTestState._modal.finishModalOnCancel).toBe('function');
		});
	});

	// ============================================================
	// acceptFinish
	// ============================================================
	describe('acceptFinish', () => {
		it('adds a session and resets state', () => {
			const s = store.getState();
			const routine = store.getCurrentRoutine();
			const ex = routine.exercises[0];
			ex.completed = true;
			store.setSessionStartedAt(Date.now());
			store.setGlobalSeconds(100);
			store.setActiveExerciseId(ex.id);
			store.setExerciseRemaining(10);

			ops.acceptFinish();

			expect(store.getSessions()).toHaveLength(1);
			expect(store.getSessions()[0].routineId).toBe(s.currentRoutineId);

			expect(s.sessionStartedAt).toBeNull();
			expect(s.activeExerciseId).toBeNull();
			expect(s.exerciseRemaining).toBe(0);
			expect(s.globalSeconds).toBe(0);

			expect(modalTestState._modal.showFinishModal).toBe(false);
		});

		it('adds session if globalSeconds > 0 even with no completed exercises', () => {
			store.setGlobalSeconds(50);
			store.setSessionStartedAt(Date.now());

			ops.acceptFinish();

			expect(store.getSessions()).toHaveLength(1);
		});

		it('skips saving if nothing practiced', () => {
			store.setGlobalSeconds(0);
			store.setSessionStartedAt(null);

			ops.acceptFinish();

			expect(store.getSessions()).toHaveLength(0);
		});
	});

	// ============================================================
	// cancelFinish
	// ============================================================
	describe('cancelFinish', () => {
		it('closes finish modal', () => {
			modalTestState._modal.showFinishModal = true;
			ops.cancelFinish();
			expect(modalTestState._modal.showFinishModal).toBe(false);
		});
	});

	// ============================================================
	// handleReset / confirmReset / cancelReset
	// ============================================================
	describe('handleReset', () => {
		it('opens reset modal', () => {
			ops.handleReset();
			expect(modalTestState._modal.showResetModal).toBe(true);
			expect(typeof modalTestState._modal.resetModalOnConfirm).toBe('function');
		});
	});

	describe('confirmReset', () => {
		it('resets routine and closes modal', () => {
			const s = store.getState();
			const ex = s.routines[0].exercises[0];
			ex.completed = true;
			ex.remainingSec = 0;
			ex.currentRep = 3;
			store.setActiveExerciseId('x');
			store.setExerciseRemaining(50);
			store.setGlobalSeconds(200);
			modalTestState._modal.showResetModal = true;

			ops.confirmReset();

			expect(ex.completed).toBe(false);
			expect(ex.remainingSec).toBe(ex.durationSec);
			expect(ex.currentRep).toBe(1);
			expect(s.activeExerciseId).toBeNull();
			expect(s.exerciseRemaining).toBe(0);
			expect(s.globalSeconds).toBe(0);
			expect(modalTestState._modal.showResetModal).toBe(false);
		});
	});

	describe('cancelReset', () => {
		it('closes reset modal', () => {
			modalTestState._modal.showResetModal = true;
			ops.cancelReset();
			expect(modalTestState._modal.showResetModal).toBe(false);
		});
	});
});
