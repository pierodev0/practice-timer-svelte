<script lang="ts">
	import { getState } from '$lib/state/store.svelte.js';
	import { formatISOTime } from '$lib/state/utils.js';
	import { downloadDayXLSX, downloadMonthXLSX } from '$lib/export.js';
	import type { Session } from '$lib/state/types.js';

	const MONTHS = [
		'Enero',
		'Febrero',
		'Marzo',
		'Abril',
		'Mayo',
		'Junio',
		'Julio',
		'Agosto',
		'Septiembre',
		'Octubre',
		'Noviembre',
		'Diciembre'
	];

	let currentYear = $state(new Date().getFullYear());
	let currentMonth = $state(new Date().getMonth());

	let s = $derived(getState());

	let editSessionId = $state<string | null>(null);

	// Events emitted to parent
	let {
		onEditSession = (_id: string) => {}
	}: {
		onEditSession: (id: string) => void;
	} = $props();

	function prevMonth() {
		currentMonth--;
		if (currentMonth < 0) {
			currentMonth = 11;
			currentYear--;
		}
	}

	function nextMonth() {
		currentMonth++;
		if (currentMonth > 11) {
			currentMonth = 0;
			currentYear++;
		}
	}

	function getMonthSessions() {
		const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
		return s.sessions
			.filter((session) => session.date && session.date.startsWith(prefix))
			.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
	}

	function getDayGroups(): Record<string, Session[]> {
		const groups: Record<string, Session[]> = {};
		getMonthSessions().forEach((session) => {
			if (!groups[session.date]) groups[session.date] = [];
			groups[session.date].push(session);
		});
		return groups;
	}

	let dayGroups = $derived(getDayGroups());
	let sortedDays = $derived(Object.keys(dayGroups).sort((a, b) => b.localeCompare(a)));

	function resolveRoutineName(session: Session): string {
		const routine = s.routines.find((r) => r.id === session.routineId);
		return routine ? routine.name : session.routineName;
	}

	function formatDuration(seconds: number): string {
		if (!seconds) return '0m';
		const h = Math.floor(seconds / 3600);
		const m = Math.round((seconds % 3600) / 60);
		return h > 0 ? `${h}h ${m}m` : `${m}m`;
	}

	function escapeHtml(str: string): string {
		if (!str) return '';
		const div = document.createElement('div');
		div.textContent = str;
		return div.innerHTML;
	}

	async function exportMonth() {
		const monthSessions = getMonthSessions();
		if (monthSessions.length === 0) {
			alert('No hay sesiones este mes.');
			return;
		}

		const groups: Record<string, Session[]> = {};
		monthSessions.forEach((session) => {
			if (!groups[session.date]) groups[session.date] = [];
			groups[session.date].push(session);
		});

		const monthLabel = `${MONTHS[currentMonth]} ${currentYear}`;
		await downloadMonthXLSX(groups, resolveRoutineName, currentYear, currentMonth, monthLabel);
	}

	async function exportDay(dateStr: string) {
		const daySessions = s.sessions.filter((ses) => ses.date === dateStr);
		if (daySessions.length === 0) return;
		await downloadDayXLSX(daySessions, resolveRoutineName, dateStr);
	}

	function editSession(id: string) {
		onEditSession(id);
	}
</script>

<div class="bg-[#E53935] text-white p-4 pt-6 pb-4 shadow-md sticky top-0 z-20">
	<h2 class="text-lg font-medium text-center"><i class="fas fa-history mr-2"></i>Historial</h2>
</div>

<!-- Month navigation -->
<div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
	<button
		onclick={prevMonth}
		class="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
	>
		<i class="fas fa-chevron-left"></i>
	</button>
	<span class="font-medium text-gray-800 text-sm" id="history-current-month"
		>{MONTHS[currentMonth]} {currentYear}</span
	>
	<div class="flex items-center gap-1">
		<button
			onclick={exportMonth}
			class="text-xs text-[#E53935] hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
			title="Exportar mes a Excel"
		>
			<i class="fas fa-file-excel mr-1"></i>Exportar mes
		</button>
		<button
			onclick={nextMonth}
			class="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
		>
			<i class="fas fa-chevron-right"></i>
		</button>
	</div>
</div>

<!-- History list -->
<div id="history-list" class="p-4">
	{#if sortedDays.length === 0}
		<p class="text-center text-gray-400 py-12">
			<i class="fas fa-calendar-times text-4xl block mb-3"></i>Sin práctica este mes
		</p>
	{:else}
		{#each sortedDays as day (day)}
			{@const [y, m, d] = day.split('-')}
			{@const dateObj = new Date(Number(y), Number(m) - 1, Number(d))}
			{@const weekday = dateObj.toLocaleDateString('es-ES', { weekday: 'long' })}
			{@const dayLabel = `${Number(d)} ${MONTHS[Number(m) - 1]}`}
			<div class="mb-4">
				<div class="flex items-center gap-2 mb-3">
					<span class="text-xs text-gray-400 font-bold uppercase"
						>{weekday}, {dayLabel}</span
					>
					<button
						onclick={() => exportDay(day)}
						class="ml-auto text-xs text-[#E53935] hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
						title="Exportar día a Excel"
					>
						<i class="fas fa-file-excel mr-1"></i>Excel
					</button>
					<div class="flex-1 h-px bg-gray-100"></div>
				</div>

				{#each dayGroups[day] as session (session.id)}
					{@const scheduledStr = formatDuration(session.scheduledSec)}
					{@const elapsedStr = formatDuration(session.elapsedSec || session.totalSec)}
					{@const startTime = formatISOTime(session.startedAt)}
					{@const endTime = formatISOTime(session.completedAt)}
					{@const routineName = resolveRoutineName(session)}
					<div class="card p-4 mb-2">
						<div class="flex items-center justify-between mb-1">
							<div class="flex items-center gap-2">
								<i class="fas fa-dumbbell text-[#E53935] text-sm"></i>
								<span class="font-bold text-gray-800 text-sm"
									>{routineName}
									<span class="text-xs text-gray-400 font-normal"
										>({scheduledStr})</span
									></span
								>
							</div>
							<button
								onclick={() => editSession(session.id)}
								class="text-xs text-gray-400 hover:text-[#E53935] p-1 rounded transition-colors"
								title="Editar sesión"
							>
								<i class="fas fa-pencil-alt"></i>
							</button>
						</div>
						<div class="text-xs text-gray-500 mb-2">
							{startTime}
							<i class="fas fa-arrow-right text-[10px] text-gray-300 mx-1"></i>
							{endTime}
							<span class="text-gray-400 font-medium ml-1">({elapsedStr})</span>
						</div>
						<div class="space-y-1">
							{#each session.exercises as ex}
								{@const statHtml =
									ex.statValue != null
										? `${ex.statName || ''}: ${ex.statValue}`
										: ''}
								<div class="flex items-center gap-2 text-xs text-gray-600">
									<i class="fas fa-check-circle text-green-500 text-[10px]"></i>
									<span>{escapeHtml(ex.title)}</span>
									{#if statHtml}
										<span class="text-[#E53935] font-medium ml-auto">{statHtml}</span>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/each}
	{/if}
</div>
