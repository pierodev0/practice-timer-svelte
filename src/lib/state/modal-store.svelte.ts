/**
 * Shared reactive store for modal and app-level state.
 * Uses $state wrapped in an object since Svelte 5 doesn't allow
 * exporting $state variables that get reassigned.
 */

// ============================================================
// Worker reference (not reactive — used imperatively)
// ============================================================
let _worker: Worker | null = null;
export function getWorker(): Worker | null {
	return _worker;
}
export function setWorker(w: Worker | null): void {
	_worker = w;
}

// ============================================================
// Reactive state (wrapped in object for safe export)
// ============================================================
export const modal = $state({
	// Sync / Auth
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	currentUser: null as any,
	syncStatus: 'idle' as 'idle' | 'syncing' | 'synced' | 'error',
	lastSyncTime: 'nunca',
	showSyncToast: false,

	// Create Exercise modal
	showCreateModal: false,

	// Stat Input modal
	showStatModal: false,
	statModalConfig: null as {
		statName: string;
		onSave: (v: number) => void;
		onSkip: () => void;
	} | null,

	// Finish modal
	showFinishModal: false,
	finishModalSummary: null as {
		exercises: number;
		scheduledSec: number;
		elapsedSec: number;
		startedAt: string | null;
		completedAt: string;
	} | null,
	finishModalOnAccept: null as (() => void) | null,
	finishModalOnCancel: null as (() => void) | null,

	// Reset modal
	showResetModal: false,
	resetModalOnConfirm: null as (() => void) | null,
	resetModalOnCancel: null as (() => void) | null,

	// Image lightbox
	showLightbox: false,
	lightboxUrl: '',

	// Edit Stats modal
	showEditStatsModal: false,

	// Edit Session modal
	showEditSessionModal: false,
	editSessionId: null as string | null
});

// ============================================================
// Convenience functions
// ============================================================

export function openCreateModal() {
	modal.showCreateModal = true;
}
export function closeCreateModal() {
	modal.showCreateModal = false;
}

export function openStatModal(config: typeof modal.statModalConfig) {
	modal.statModalConfig = config;
	modal.showStatModal = true;
}
export function closeStatModal() {
	modal.showStatModal = false;
	modal.statModalConfig = null;
}

export function openFinishModal(
	summary: typeof modal.finishModalSummary,
	onAccept: () => void,
	onCancel: () => void
) {
	modal.finishModalSummary = summary;
	modal.finishModalOnAccept = onAccept;
	modal.finishModalOnCancel = onCancel;
	modal.showFinishModal = true;
}
export function closeFinishModal() {
	modal.showFinishModal = false;
	modal.finishModalSummary = null;
	modal.finishModalOnAccept = null;
	modal.finishModalOnCancel = null;
}

export function openResetModal(onConfirm: () => void, onCancel: () => void) {
	modal.resetModalOnConfirm = onConfirm;
	modal.resetModalOnCancel = onCancel;
	modal.showResetModal = true;
}
export function closeResetModal() {
	modal.showResetModal = false;
	modal.resetModalOnConfirm = null;
	modal.resetModalOnCancel = null;
}

export function openLightbox(url: string) {
	modal.lightboxUrl = url;
	modal.showLightbox = true;
}
export function closeLightbox() {
	modal.showLightbox = false;
	modal.lightboxUrl = '';
}

export function openEditStatsModal() {
	modal.showEditStatsModal = true;
}
export function closeEditStatsModal() {
	modal.showEditStatsModal = false;
}

export function openEditSessionModal(id: string) {
	modal.editSessionId = id;
	modal.showEditSessionModal = true;
}
export function closeEditSessionModal() {
	modal.showEditSessionModal = false;
	modal.editSessionId = null;
}
