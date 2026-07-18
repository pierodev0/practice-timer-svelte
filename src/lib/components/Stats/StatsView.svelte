<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getState } from '$lib/state/store.svelte.js';
	import { stringToColor, todayStr, formatDate } from '$lib/state/utils.js';
	import { subDays, differenceInCalendarDays } from 'date-fns';
	import StatCard from './StatCard.svelte';

	let s = $derived(getState());

	// Chart instances
	let weeklyChartInstance: any = null;
	let routineChartInstance: any = null;
	let progressChartInstance: any = null;
	let scheduleChartInstance: any = null;

	// Canvas refs
	let weeklyCanvas: HTMLCanvasElement;
	let routineCanvas: HTMLCanvasElement;
	let progressCanvas: HTMLCanvasElement;
	let scheduleCanvas: HTMLCanvasElement;

	// Filter state
	let filterStart = $state('');
	let filterEnd = $state('');

	// Events
	let {
		onManageData = () => {}
	}: {
		onManageData: () => void;
	} = $props();

	onMount(() => {
		renderStats();
	});

	onDestroy(() => {
		weeklyChartInstance?.destroy();
		routineChartInstance?.destroy();
		progressChartInstance?.destroy();
		scheduleChartInstance?.destroy();
	});

	function renderStats() {
		const state = s;
		const entries = Object.entries(state.stats);

		// Summary calculations are done via $derived
	}

	// ============================================================
	// Summary calculations
	// ============================================================

	let totalSecondsAllTime = $derived.by(() => {
		return Object.entries(s.stats).reduce((acc, [_, data]) => acc + (data.totalSec || 0), 0);
	});

	let totalHours = $derived(Math.floor(totalSecondsAllTime / 3600));
	let totalMinutes = $derived(Math.floor((totalSecondsAllTime % 3600) / 60));
	let totalPracticedStr = $derived(
		totalHours > 0 ? `${totalHours}h ${totalMinutes}m` : `${totalMinutes}m`
	);

	let sortedDateKeys = $derived(Object.keys(s.stats).sort());
	let sessionsCount = $derived(sortedDateKeys.length);

	let avgMinutes = $derived(
		sessionsCount > 0 ? Math.round(totalSecondsAllTime / 60 / sessionsCount) : 0
	);

	let streak = $derived.by(() => {
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
	});

	// ============================================================
	// Weekly chart (bar - stacked by routine)
	// ============================================================

	function renderWeeklyChart() {
		if (!weeklyCanvas) return;

		const last7DaysLabels: string[] = [];
		const last7DaysKeys: string[] = [];
		for (let i = 6; i >= 0; i--) {
			const d = subDays(new Date(), i);
			last7DaysKeys.push(formatDate(d));
			last7DaysLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
		}

		const uniqueRoutines = new Set<string>();
		last7DaysKeys.forEach((k) => {
			if (s.stats[k]?.routines) {
				Object.keys(s.stats[k].routines).forEach((r) => uniqueRoutines.add(r));
			}
		});

		const datasets = Array.from(uniqueRoutines).map((name) => ({
			label: name,
			data: last7DaysKeys.map(
				(k) => Math.round((s.stats[k]?.routines?.[name] || 0) / 60)
			),
			backgroundColor: stringToColor(name),
			borderRadius: 2
		}));

		if (weeklyChartInstance) weeklyChartInstance.destroy();
		weeklyChartInstance = new Chart(weeklyCanvas.getContext('2d')!, {
			type: 'bar',
			data: { labels: last7DaysLabels, datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: true,
						position: 'bottom',
						labels: { boxWidth: 10, font: { size: 10 } }
					}
				},
				scales: {
					x: { stacked: true },
					y: { stacked: true, beginAtZero: true }
				}
			}
		});
	}

	// ============================================================
	// Routine chart (doughnut)
	// ============================================================

	function renderRoutineChart() {
		if (!routineCanvas) return;

		const entries = Object.entries(s.stats);
		const routineTotals: Record<string, number> = {};
		entries.forEach(([_, d]) => {
			if (d.routines) {
				Object.entries(d.routines).forEach(([name, secs]) => {
					routineTotals[name] = (routineTotals[name] || 0) + secs;
				});
			}
		});

		const labels = Object.keys(routineTotals);
		const data = Object.values(routineTotals).map((s) => Math.round(s / 60));
		const colors = labels.map(stringToColor);

		if (routineChartInstance) routineChartInstance.destroy();
		routineChartInstance = new Chart(routineCanvas.getContext('2d')!, {
			type: 'doughnut',
			data: {
				labels,
				datasets: [{ data, backgroundColor: colors, borderWidth: 0 }]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: 'right',
						labels: { boxWidth: 10, font: { size: 10 } }
					}
				}
			}
		});
	}

	// ============================================================
	// Progress chart (line)
	// ============================================================

	function renderProgressChart() {
		if (!progressCanvas) return;

		let allStats: Array<{ name: string; logs: Array<{ date: string; value: number }> }> = [];
		s.routines.forEach((r) => {
			r.exercises.forEach((e) => {
				if (e.statisticLogs && e.statisticLogs.length > 0) {
					allStats.push({
						name: `${e.title} (${e.statisticName})`,
						logs: e.statisticLogs
					});
				}
			});
		});

		const startVal = filterStart || '';
		const endVal = filterEnd || '';

		let uniqueDates = new Set<string>();
		allStats.forEach((stat) => {
			stat.logs.forEach((log) => {
				if (
					(!startVal || log.date >= startVal) &&
					(!endVal || log.date <= endVal)
				) {
					uniqueDates.add(log.date);
				}
			});
		});
		const sortedDates = Array.from(uniqueDates).sort();

		const datasets = allStats
			.map((stat) => {
				const data = sortedDates.map((date) => {
					const entry = [...stat.logs]
						.reverse()
						.find((l) => l.date === date);
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

		if (progressChartInstance) progressChartInstance.destroy();
		progressChartInstance = new Chart(progressCanvas.getContext('2d')!, {
			type: 'line',
			data: { labels: sortedDates, datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: true,
						position: 'bottom',
						labels: { boxWidth: 10, font: { size: 10 } }
					},
					tooltip: { mode: 'index', intersect: false }
				},
				scales: {
					x: { title: { display: true, text: 'Date' } },
					y: {
						title: { display: true, text: 'Value' },
						beginAtZero: true
					}
				}
			}
		});
	}

	// ============================================================
	// Scheduled vs Real chart (bar)
	// ============================================================

	function renderScheduleChart() {
		if (!scheduleCanvas) return;

		const days: Record<string, { scheduled: number; elapsed: number }> = {};
		s.sessions.forEach((ses) => {
			if (!ses.scheduledSec || !ses.elapsedSec) return;
			if (!days[ses.date]) days[ses.date] = { scheduled: 0, elapsed: 0 };
			days[ses.date].scheduled += ses.scheduledSec;
			days[ses.date].elapsed += ses.elapsedSec;
		});

		const sortedDates = Object.keys(days)
			.sort()
			.slice(-14);
		const scheduledData = sortedDates.map(
			(d) => Math.round((days[d].scheduled || 0) / 60)
		);
		const elapsedData = sortedDates.map(
			(d) => Math.round((days[d].elapsed || 0) / 60)
		);
		const labels = sortedDates.map((d) => {
			const [y, m, day] = d.split('-');
			return `${Number(day)}/${m}`;
		});

		if (scheduleChartInstance) scheduleChartInstance.destroy();
		scheduleChartInstance = new Chart(scheduleCanvas.getContext('2d')!, {
			type: 'bar',
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
					legend: {
						display: true,
						position: 'bottom',
						labels: { boxWidth: 10, font: { size: 10 } }
					},
					tooltip: {
						callbacks: {
							label: (ctx: any) =>
								`${ctx.dataset.label}: ${ctx.parsed.y}min`
						}
					}
				},
				scales: {
					x: { title: { display: true, text: 'Día' } },
					y: {
						title: { display: true, text: 'Minutos' },
						beginAtZero: true
					}
				}
			}
		});
	}

	// ============================================================
	// Actions
	// ============================================================

	function applyFilter() {
		renderProgressChart();
	}

	function renderAllCharts() {
		renderWeeklyChart();
		renderRoutineChart();
		renderProgressChart();
		renderScheduleChart();
	}

	// Effect to re-render charts when data changes
	$effect(() => {
		// Access reactive dependencies to trigger re-render
		const _ = s.stats;
		const __ = s.sessions;
		const ___ = s.routines;
		if (weeklyCanvas && routineCanvas && progressCanvas && scheduleCanvas) {
			renderAllCharts();
		}
	});
</script>

<div class="bg-[#E53935] text-white p-4 pt-6 pb-4 shadow-md sticky top-0 z-20">
	<h2 class="text-lg font-medium text-center"><i class="fas fa-chart-line mr-2"></i>Stats</h2>
</div>

<!-- Summary cards -->
<div class="grid grid-cols-2 gap-3 p-4">
	<StatCard title="Total Practicado" value={totalPracticedStr} subtitle="Todo el tiempo" icon="fa-clock" />
	<StatCard title="Racha" value={String(streak)} subtitle="Días consecutivos" icon="fa-fire" />
	<StatCard title="Sesiones" value={String(sessionsCount)} subtitle="Días con práctica" icon="fa-calendar-check" />
	<StatCard title="Promedio" value={`${avgMinutes}m`} subtitle="Por sesión" icon="fa-chart-line" />
</div>

<!-- Weekly Chart -->
<div class="card m-4 p-4">
	<h3 class="text-sm font-bold text-gray-700 mb-3">
		<i class="fas fa-chart-bar text-[#E53935] mr-1"></i>Últimos 7 días
	</h3>
	<div class="h-48">
		<canvas bind:this={weeklyCanvas} id="weeklyChart"></canvas>
	</div>
</div>

<!-- Routine Doughnut -->
<div class="card m-4 p-4">
	<h3 class="text-sm font-bold text-gray-700 mb-3">
		<i class="fas fa-chart-pie text-[#E53935] mr-1"></i>Distribución por rutina
	</h3>
	<div class="h-48">
		<canvas bind:this={routineCanvas} id="routineChart"></canvas>
	</div>
</div>

<!-- Progress Chart -->
<div class="card m-4 p-4">
	<div class="flex items-center justify-between mb-3">
		<h3 class="text-sm font-bold text-gray-700">
			<i class="fas fa-chart-line text-[#E53935] mr-1"></i>Progreso
		</h3>
		<div class="flex items-center gap-2">
			<input
				type="date"
				bind:value={filterStart}
				class="text-xs border border-gray-200 rounded px-2 py-1 w-32"
				placeholder="Desde"
			/>
			<input
				type="date"
				bind:value={filterEnd}
				class="text-xs border border-gray-200 rounded px-2 py-1 w-32"
				placeholder="Hasta"
			/>
			<button
				onclick={applyFilter}
				class="text-xs bg-[#E53935] text-white px-2 py-1 rounded hover:bg-red-700 transition-colors"
			>
				<i class="fas fa-filter"></i>
			</button>
		</div>
	</div>
	<div class="h-48">
		<canvas bind:this={progressCanvas} id="progressChart"></canvas>
	</div>
</div>

<!-- Scheduled vs Real Chart -->
<div class="card m-4 p-4">
	<h3 class="text-sm font-bold text-gray-700 mb-3">
		<i class="fas fa-clock text-[#E53935] mr-1"></i>Programado vs Real
	</h3>
	<div class="h-48">
		<canvas bind:this={scheduleCanvas} id="scheduleChart"></canvas>
	</div>
</div>

<!-- Manage data button -->
<div class="p-4 pt-0">
	<button
		onclick={onManageData}
		class="w-full py-2.5 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
	>
		<i class="fas fa-database mr-1"></i>Gestionar Datos
	</button>
</div>
