/**
 * Backup & Restore operations.
 *
 * Encapsulates all logic for exporting, importing, and deleting data.
 * Keeps settings route pages thin — they only call these functions.
 */
import { getState, getCurrentRoutine } from './state.svelte.js';
import { downloadJSON } from './utils.js';
import { resetAllData } from './persistence.js';

// ============================================================
// Show archived exercises (simple alert)
// ============================================================

export function showArchivedExercises(): void {
	const routine = getCurrentRoutine();
	const archived = routine.exercises.filter((e) => e.archived);
	if (archived.length === 0) {
		alert('No hay ejercicios archivados.');
		return;
	}
	const list = archived.map((ex, i) => `${i + 1}. ${ex.title} (${ex.bpm} BPM)`).join('\n');
	alert(`Ejercicios archivados (${archived.length}):\n\n${list}`);
}

// ============================================================
// Export all data as JSON download
// ============================================================

export function exportAllData(): void {
	const s = getState();
	downloadJSON(
		JSON.stringify({ routines: s.routines, stats: s.stats, sessions: s.sessions }, null, 2),
		`backup_${new Date().toISOString().slice(0, 10)}.json`
	);
}

// ============================================================
// Delete all data (with double confirmation)
// ============================================================

export function deleteAllData(): void {
	const confirmed = confirm(
		'⚠️ ¿Estás seguro?\n\nEsta acción borrará TODOS tus datos:\n• Rutinas y ejercicios\n• Estadísticas\n• Historial de práctica\n\nNo se puede deshacer.'
	);
	if (!confirmed) return;

	const doubleCheck = prompt('Escribe "BORRAR" para confirmar:');
	if (doubleCheck !== 'BORRAR') {
		alert('Cancelado. No se borró nada.');
		return;
	}

	resetAllData();
	alert('Todos los datos han sido eliminados.');
}
