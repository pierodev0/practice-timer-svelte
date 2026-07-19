/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid' }));

// Mock downloadJSON from utils
const mockDownloadJSON = vi.fn();
vi.mock('./utils.js', () => ({
	todayStr: () => '2026-07-18',
	downloadJSON: mockDownloadJSON,
	deepClone: (obj: any) => JSON.parse(JSON.stringify(obj))
}));

describe('backup-ops', () => {
	let ops: typeof import('./backup-ops.js');
	let store: typeof import('./store.svelte.js');

	beforeEach(async () => {
		vi.resetModules();
		mockDownloadJSON.mockClear();

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

		store = await import('./store.svelte.js');
		store.resetAllData();
		vi.clearAllMocks();

		ops = await import('./backup-ops.js');
	});

	// ============================================================
	// exportAllData
	// ============================================================
	describe('exportAllData', () => {
		it('exports routines, stats, and sessions as JSON', () => {
			const s = store.getState();
			s.stats['2026-07-18'] = { totalSec: 300, routines: { 'Module 1': 300 } };

			ops.exportAllData();

			expect(mockDownloadJSON).toHaveBeenCalledOnce();
			const [json, filename] = mockDownloadJSON.mock.calls[0];
			expect(filename).toMatch(/^backup_\d{4}-\d{2}-\d{2}\.json$/);
			const parsed = JSON.parse(json);
			expect(parsed.routines).toHaveLength(12);
			expect(parsed.stats['2026-07-18'].totalSec).toBe(300);
			expect(Array.isArray(parsed.sessions)).toBe(true);
		});
	});

	// ============================================================
	// deleteAllData
	// ============================================================
	describe('deleteAllData', () => {
		it('resets to factory defaults when confirmed with BORRAR', () => {
			const s = store.getState();
			// Store has 12 routines initially
			expect(s.routines.length).toBe(12);

			vi.stubGlobal('confirm', vi.fn(() => true));
			vi.stubGlobal('prompt', vi.fn(() => 'BORRAR'));
			vi.stubGlobal('alert', vi.fn());

			ops.deleteAllData();

			// resetAllData restores factory defaults (12 sample routines)
			expect(s.routines).toHaveLength(12);
			expect(s.stats).toEqual({});
			expect(s.sessions).toEqual([]);
		});

		it('does nothing if confirm is cancelled', () => {
			const s = store.getState();
			vi.stubGlobal('confirm', vi.fn(() => false));
			vi.stubGlobal('alert', vi.fn());

			ops.deleteAllData();

			expect(s.routines.length).toBeGreaterThan(0);
		});

		it('does nothing if BORRAR is not typed', () => {
			const s = store.getState();
			vi.stubGlobal('confirm', vi.fn(() => true));
			vi.stubGlobal('prompt', vi.fn(() => 'wrong'));
			vi.stubGlobal('alert', vi.fn());

			ops.deleteAllData();

			expect(s.routines.length).toBeGreaterThan(0);
		});
	});

	// ============================================================
	// showArchivedExercises
	// ============================================================
	describe('showArchivedExercises', () => {
		it('shows alert with archived exercises list', () => {
			const mockAlert = vi.fn();
			vi.stubGlobal('alert', mockAlert);

			const s = store.getState();
			const ex = s.routines[0].exercises[0];
			ex.archived = true;

			ops.showArchivedExercises();

			expect(mockAlert).toHaveBeenCalled();
			expect(mockAlert.mock.calls[0][0]).toContain(ex.title);
		});

		it('shows message if no archived exercises', () => {
			const mockAlert = vi.fn();
			vi.stubGlobal('alert', mockAlert);

			ops.showArchivedExercises();

			expect(mockAlert).toHaveBeenCalled();
			expect(mockAlert.mock.calls[0][0]).toContain('archivados');
		});
	});
});
