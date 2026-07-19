/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid' }));

const mockDownloadJSON = vi.fn();
vi.mock('./utils.js', () => ({
	downloadJSON: mockDownloadJSON,
	deepClone: (obj: any) => JSON.parse(JSON.stringify(obj)),
	sanitizeImportedRoutine: (r: any) => ({
		...r,
		id: 'test-nanoid',
		exercises: (r.exercises || []).map((ex: any) => ({
			...ex,
			id: 'test-nanoid',
			remainingSec: ex.durationSec || 60,
			autoStart: ex.autoStart ?? true,
			archived: ex.archived ?? false,
			reps: ex.reps ?? 1,
			currentRep: ex.currentRep ?? 1,
			comment: ex.comment ?? '',
			statisticName: ex.statisticName || null,
			statisticLogs: ex.statisticLogs || []
		}))
	})
}));

describe('routines CRUD', () => {
	let ops: typeof import('./routines-ops.js');
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

		ops = await import('./routines-ops.js');
	});

	// ============================================================
	// addRoutine
	// ============================================================
	describe('addRoutine', () => {
		it('creates a new routine with given name', () => {
			const s = store.getState();
			const before = s.routines.length;

			s.routines.push(ops.createRoutine('New Routine'));

			expect(s.routines).toHaveLength(before + 1);
			expect(s.routines.at(-1)?.name).toBe('New Routine');
		});
	});

	// ============================================================
	// renameRoutine
	// ============================================================
	describe('renameRoutine', () => {
		it('renames a routine by id', () => {
			const s = store.getState();
			const r = s.routines[0];

			ops.renameRoutine(r.id, 'Updated Name');

			expect(r.name).toBe('Updated Name');
		});

		it('does nothing for non-existent id', () => {
			expect(() => ops.renameRoutine('no-such', 'X')).not.toThrow();
		});
	});

	// ============================================================
	// exportRoutine
	// ============================================================
	describe('exportRoutine', () => {
		it('exports a single routine as JSON download', () => {
			const s = store.getState();
			const r = s.routines[0];

			ops.exportRoutine(r.id);

			expect(mockDownloadJSON).toHaveBeenCalledOnce();
			const [json, filename] = mockDownloadJSON.mock.calls[0];
			expect(filename).toMatch(/^routine_.*\.json$/);
			const parsed = JSON.parse(json);
			expect(parsed.id).toBe(r.id);
			expect(parsed.name).toBe(r.name);
		});

		it('does nothing for non-existent id', () => {
			ops.exportRoutine('no-such');
			expect(mockDownloadJSON).not.toHaveBeenCalled();
		});
	});

	// ============================================================
	// duplicateRoutineById
	// ============================================================
	describe('duplicateRoutineById', () => {
		it('duplicates a routine with (Copia) suffix', () => {
			const s = store.getState();
			const before = s.routines.length;

			ops.duplicateRoutineById(s.routines[0].id);

			expect(s.routines).toHaveLength(before + 1);
			const copy = s.routines.at(-1)!;
			expect(copy.name).toBe(s.routines[0].name + ' (Copia)');
			expect(copy.exercises).toHaveLength(s.routines[0].exercises.length);
		});

		it('does nothing for non-existent id', () => {
			ops.duplicateRoutineById('no-such');
			expect(store.getState().routines).toHaveLength(12);
		});
	});

	// ============================================================
	// deleteRoutineById
	// ============================================================
	describe('deleteRoutineById', () => {
		it('removes a routine and switches to first if current was deleted', () => {
			const s = store.getState();
			const target = s.routines[0];
			const before = s.routines.length;

			const result = ops.deleteRoutineById(target.id);

			expect(result).toBe(true);
			expect(s.routines).toHaveLength(before - 1);
			expect(s.routines.find((r) => r.id === target.id)).toBeUndefined();
		});

		it('does nothing if it is the last routine', () => {
			const s = store.getState();
			// Remove all but one
			while (s.routines.length > 1) {
				s.routines.pop();
			}
			expect(s.routines).toHaveLength(1);

			const result = ops.deleteRoutineById(s.routines[0].id);
			expect(result).toBe(false);
			expect(s.routines).toHaveLength(1);
		});

		it('returns false for non-existent id', () => {
			expect(ops.deleteRoutineById('no-such')).toBe(false);
		});
	});

	// ============================================================
	// importRoutinesFromJson
	// ============================================================
	describe('importRoutinesFromJson', () => {
		it('imports valid JSON and adds routines', () => {
			const s = store.getState();
			const before = s.routines.length;

			const result = ops.importRoutinesFromJson(
				JSON.stringify([{ name: 'Imported 1', exercises: [] }])
			);

			expect(result).toContain('Importada');
			expect(s.routines).toHaveLength(before + 1);
		});

		it('wraps single object in array', () => {
			const s = store.getState();
			const before = s.routines.length;

			ops.importRoutinesFromJson(
				JSON.stringify({ name: 'Single', exercises: [] })
			);

			expect(s.routines).toHaveLength(before + 1);
		});

		it('throws on invalid JSON', () => {
			expect(() => ops.importRoutinesFromJson('not-json')).toThrow();
		});
	});
});
