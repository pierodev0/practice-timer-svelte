/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./utils.js', () => ({
	stringToColor: (s: string) => {
		const hash = s.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
		return `#${(hash % 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`;
	},
	formatDate: (d: Date) => {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	},
	formatTime: (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
	todayStr: () => '2026-07-19'
}));

describe('charts data preparation', () => {
	let charts: typeof import('./charts.js');

	beforeEach(async () => {
		vi.resetModules();
		charts = await import('./charts.js');
	});

	describe('buildWeeklyChartConfig', () => {
		it('returns data and options for a bar chart', () => {
			const stats = {
				'2026-07-13': { totalSec: 600, routines: { 'Module 1': 600 } }
			};
			const result = charts.buildWeeklyChartConfig(stats);
			expect(result.data).toBeDefined();
			expect(result.data.labels).toHaveLength(7);
			expect(result.data.datasets).toBeInstanceOf(Array);
			expect(result.options).toBeDefined();
			expect(result.options.scales).toBeDefined();
		});

		it('returns empty datasets when stats is empty', () => {
			const result = charts.buildWeeklyChartConfig({});
			expect(result.data.datasets).toHaveLength(0);
		});
	});

	describe('buildRoutineChartConfig', () => {
		it('returns data and options with routine totals', () => {
			const stats = {
				'2026-07-18': { totalSec: 600, routines: { 'Module 1': 600 } }
			};
			const result = charts.buildRoutineChartConfig(stats);
			expect(result.data.labels).toContain('Module 1');
			expect(result.data.datasets[0].data[0]).toBe(10);
			expect(result.options).toBeDefined();
		});

		it('returns empty when stats is empty', () => {
			const result = charts.buildRoutineChartConfig({});
			expect(result.data.labels).toHaveLength(0);
		});
	});

	describe('buildProgressChartConfig', () => {
		it('returns data and options with exercise progress', () => {
			const routines: any = [
				{
					id: 'r1',
					name: 'Test',
					exercises: [
						{
							id: 'e1',
							title: 'Scales',
							bpm: 60,
							durationSec: 120,
							remainingSec: 120,
							completed: false,
							autoStart: false,
							archived: false,
							reps: 1,
							currentRep: 1,
							comment: '',
							statisticName: 'BPM',
							statisticLogs: [{ date: '2026-07-18', value: 120 }]
						}
					]
				}
			];
			const result = charts.buildProgressChartConfig(routines, '', '');
			expect(result.data.datasets).toHaveLength(1);
			expect(result.data.datasets[0].label).toContain('Scales');
			expect(result.options).toBeDefined();
		});

		it('returns empty datasets when no statisticLogs', () => {
			const routines: any = [
				{
					id: 'r1',
					name: 'Test',
					exercises: [
						{
							id: 'e1',
							title: 'Scales',
							bpm: 60,
							durationSec: 120,
							remainingSec: 120,
							completed: false,
							autoStart: false,
							archived: false,
							reps: 1,
							currentRep: 1,
							comment: '',
							statisticName: null,
							statisticLogs: []
						}
					]
				}
			];
			const result = charts.buildProgressChartConfig(routines, '', '');
			expect(result.data.datasets).toHaveLength(0);
		});

		it('filters by date range', () => {
			const routines: any = [
				{
					id: 'r1',
					name: 'Test',
					exercises: [
						{
							id: 'e1',
							title: 'Scales',
							bpm: 60,
							durationSec: 120,
							remainingSec: 120,
							completed: false,
							autoStart: false,
							archived: false,
							reps: 1,
							currentRep: 1,
							comment: '',
							statisticName: 'BPM',
							statisticLogs: [
								{ date: '2026-07-17', value: 100 },
								{ date: '2026-07-18', value: 120 },
								{ date: '2026-07-19', value: 130 }
							]
						}
					]
				}
			];
			const result = charts.buildProgressChartConfig(routines, '2026-07-18', '2026-07-19');
			expect(result.data.labels).toEqual(['2026-07-18', '2026-07-19']);
		});
	});

	describe('buildScheduleChartConfig', () => {
		it('returns data and options with scheduled vs real data', () => {
			const sessions: any = [
				{
					id: 's1',
					date: '2026-07-18',
					routineId: 'r1',
					routineName: 'Test',
					startedAt: '2026-07-18T10:00:00Z',
					completedAt: '2026-07-18T10:30:00Z',
					scheduledSec: 1800,
					totalSec: 1800,
					elapsedSec: 1800,
					exercises: []
				}
			];
			const result = charts.buildScheduleChartConfig(sessions);
			expect(result.data.datasets).toHaveLength(2);
			expect(result.data.datasets[0].label).toBe('Programado');
			expect(result.data.datasets[1].label).toBe('Real');
			expect(result.options).toBeDefined();
		});

		it('returns empty data when sessions is empty', () => {
			const result = charts.buildScheduleChartConfig([]);
			expect(result.data.labels).toHaveLength(0);
		});
	});
});
