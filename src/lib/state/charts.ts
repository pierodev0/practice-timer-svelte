/**
 * Chart data preparation.
 * Pure functions that transform state data into Chart.js data + options objects.
 * No Chart.js instances created here — the svelte-chartjs library handles rendering.
 */
import { subDays } from 'date-fns';
import { formatDate, stringToColor } from './utils.js';
import type { StatsEntry, Session, Routine } from './types.js';

// ============================================================
// Weekly bar chart (stacked by routine)
// ============================================================

export function buildWeeklyChartConfig(stats: Record<string, StatsEntry>): { data: any; options: any } {
	const labels: string[] = [];
	const dateKeys: string[] = [];
	for (let i = 6; i >= 0; i--) {
		const d = subDays(new Date(), i);
		dateKeys.push(formatDate(d));
		labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
	}

	const uniqueRoutines = new Set<string>();
	dateKeys.forEach((k) => {
		if (stats[k]?.routines) {
			Object.keys(stats[k].routines).forEach((r) => uniqueRoutines.add(r));
		}
	});

	const datasets = Array.from(uniqueRoutines).map((name) => ({
		label: name,
		data: dateKeys.map((k) => Math.round((stats[k]?.routines?.[name] || 0) / 60)),
		backgroundColor: stringToColor(name),
		borderRadius: 2
	}));

	return {
		data: { labels, datasets },
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { display: true, position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 10 } } }
			},
			scales: {
				x: { stacked: true },
				y: { stacked: true, beginAtZero: true }
			}
		}
	};
}

// ============================================================
// Routine doughnut chart
// ============================================================

export function buildRoutineChartConfig(stats: Record<string, StatsEntry>): { data: any; options: any } {
	const entries = Object.entries(stats);
	const routineTotals: Record<string, number> = {};
	entries.forEach(([, d]) => {
		if (d.routines) {
			Object.entries(d.routines).forEach(([name, secs]) => {
				routineTotals[name] = (routineTotals[name] || 0) + (secs as number);
			});
		}
	});

	const labels = Object.keys(routineTotals);
	const data = Object.values(routineTotals).map((s) => Math.round(s / 60));
	const colors = labels.map(stringToColor);

	return {
		data: {
			labels,
			datasets: [{ data, backgroundColor: colors, borderWidth: 0 }]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { position: 'right' as const, labels: { boxWidth: 10, font: { size: 10 } } }
			}
		}
	};
}

// ============================================================
// Progress line chart (with optional date filter)
// ============================================================

export function buildProgressChartConfig(
	routines: Routine[],
	filterStart: string,
	filterEnd: string
): { data: any; options: any } {
	const allStats: Array<{ name: string; logs: Array<{ date: string; value: number }> }> = [];
	routines.forEach((r) => {
		r.exercises.forEach((e) => {
			if (e.statisticLogs && e.statisticLogs.length > 0) {
				allStats.push({
					name: `${e.title} (${e.statisticName})`,
					logs: e.statisticLogs
				});
			}
		});
	});

	const uniqueDates = new Set<string>();
	allStats.forEach((stat) => {
		stat.logs.forEach((log) => {
			if (
				(!filterStart || log.date >= filterStart) &&
				(!filterEnd || log.date <= filterEnd)
			) {
				uniqueDates.add(log.date);
			}
		});
	});
	const sortedDates = Array.from(uniqueDates).sort();

	const datasets = allStats
		.map((stat) => {
			const data = sortedDates.map((date) => {
				const entry = [...stat.logs].reverse().find((l) => l.date === date);
				return entry ? entry.value : null;
			});
			if (data.every((v) => v === null)) return null;
			return {
				label: stat.name,
				data,
				borderColor: stringToColor(stat.name),
				backgroundColor: stringToColor(stat.name),
				tension: 0.1,
				fill: false,
				spanGaps: true
			};
		})
		.filter((ds) => ds !== null);

	return {
		data: { labels: sortedDates, datasets },
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { display: true, position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 10 } } },
				tooltip: { mode: 'index' as const, intersect: false }
			},
			scales: {
				x: { title: { display: true, text: 'Date' } },
				y: { title: { display: true, text: 'Value' }, beginAtZero: true }
			}
		}
	};
}

// ============================================================
// Scheduled vs Real bar chart
// ============================================================

export function buildScheduleChartConfig(sessions: Session[]): { data: any; options: any } {
	const days: Record<string, { scheduled: number; elapsed: number }> = {};
	sessions.forEach((ses) => {
		if (!ses.scheduledSec || !ses.elapsedSec) return;
		if (!days[ses.date]) days[ses.date] = { scheduled: 0, elapsed: 0 };
		days[ses.date].scheduled += ses.scheduledSec;
		days[ses.date].elapsed += ses.elapsedSec;
	});

	const sortedDates = Object.keys(days).sort().slice(-14);
	const scheduledData = sortedDates.map((d) => Math.round((days[d].scheduled || 0) / 60));
	const elapsedData = sortedDates.map((d) => Math.round((days[d].elapsed || 0) / 60));
	const labels = sortedDates.map((d) => {
		const [, m, day] = d.split('-');
		return `${Number(day)}/${m}`;
	});

	return {
		data: {
			labels,
			datasets: [
				{
					label: 'Programado',
					data: scheduledData,
					backgroundColor: 'rgba(156, 163, 175, 0.6)',
					borderColor: 'rgba(156, 163, 175, 1)',
					borderWidth: 1
				},
				{
					label: 'Real',
					data: elapsedData,
					backgroundColor: 'rgba(229, 57, 53, 0.6)',
					borderColor: 'rgba(229, 57, 53, 1)',
					borderWidth: 1
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { display: true, position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 10 } } },
				tooltip: {
					callbacks: {
						label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y}min`
					}
				}
			},
			scales: {
				x: { title: { display: true, text: 'Día' } },
				y: { title: { display: true, text: 'Minutos' }, beginAtZero: true }
			}
		}
	};
}
