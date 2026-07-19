<!--
  Stats page — thin orchestrator.
  Uses svelte-chartjs components for rendering (handles lifecycle properly).
  Chart configs computed via $derived — only re-run when data changes.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { registerables, Chart } from 'chart.js';
	import { Bar, Doughnut, Line } from 'svelte-chartjs';
	import { getState } from '$lib/state/store.svelte.js';
	import { calcTotalSeconds, calcPracticedStr, calcSessionsCount, calcAvgMinutes, calcStreak } from '$lib/state/stats-ops.js';
	import { buildWeeklyChartConfig, buildRoutineChartConfig, buildProgressChartConfig, buildScheduleChartConfig } from '$lib/state/charts.js';
	import StatCard from '$lib/components/Stats/StatCard.svelte';
	import { openEditStatsModal } from '$lib/state/modal-store.svelte.js';

	// Register all Chart.js components once
	onMount(() => {
		Chart.register(...registerables);
	});

	let s = $derived(getState());

	// Filter state (only for progress chart)
	let filterStart = $state('');
	let filterEnd = $state('');

	// ============================================================
	// Summary (via derived, testable helpers)
	// ============================================================
	let totalSecondsAllTime = $derived(calcTotalSeconds(s.stats));
	let totalPracticedStr = $derived(calcPracticedStr(totalSecondsAllTime));
	let sessionsCount = $derived(calcSessionsCount(s.stats));
	let avgMinutes = $derived(calcAvgMinutes(totalSecondsAllTime, sessionsCount));
	let streak = $derived(calcStreak(s.stats));

	// ============================================================
	// Chart configs (via derived, only re-run when data changes)
	// ============================================================
	let weeklyConfig = $derived(buildWeeklyChartConfig(s.stats));
	let routineConfig = $derived(buildRoutineChartConfig(s.stats));
	let progressConfig = $derived(buildProgressChartConfig(s.routines, filterStart, filterEnd));
	let scheduleConfig = $derived(buildScheduleChartConfig(s.sessions));

	function applyFilter() {
		// trigger is automatic via $derived on filterStart/filterEnd
	}
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
		<Bar data={weeklyConfig.data} options={weeklyConfig.options} />
	</div>
</div>

<!-- Routine Doughnut -->
<div class="card m-4 p-4">
	<h3 class="text-sm font-bold text-gray-700 mb-3">
		<i class="fas fa-chart-pie text-[#E53935] mr-1"></i>Distribución por rutina
	</h3>
	<div class="h-48">
		<Doughnut data={routineConfig.data} options={routineConfig.options} />
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
				aria-label="Aplicar filtro"
			>
				<i class="fas fa-filter"></i>
			</button>
		</div>
	</div>
	<div class="h-48">
		<Line data={progressConfig.data} options={progressConfig.options} />
	</div>
</div>

<!-- Scheduled vs Real Chart -->
<div class="card m-4 p-4">
	<h3 class="text-sm font-bold text-gray-700 mb-3">
		<i class="fas fa-clock text-[#E53935] mr-1"></i>Programado vs Real
	</h3>
	<div class="h-48">
		<Bar data={scheduleConfig.data} options={scheduleConfig.options} />
	</div>
</div>

<!-- Manage data button -->
<div class="p-4 pt-0">
	<button
		onclick={openEditStatsModal}
		class="w-full py-2.5 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
	>
		<i class="fas fa-database mr-1"></i>Gestionar Datos
	</button>
</div>
