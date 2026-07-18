import {
	doc,
	setDoc,
	getDoc,
	getDocs,
	deleteDoc,
	collection,
	query,
	orderBy,
	serverTimestamp,
	onSnapshot
} from 'firebase/firestore';
import { db } from './config.js';
import { getDeviceId } from './device.js';
import { exportSyncState, importSyncState, type SyncPayload } from './serializer.js';
import { mergeState } from './merge.js';

const CLOUD_SYNC_KEY = 'music-cloud-sync';

let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let unsubscribeSnapshot: (() => void) | null = null;
let initialSyncDone = false;

// ── Helpers ────────────────────────────────────────────────

function getDocRef(uid: string) {
	return doc(db, 'users', uid, 'app', 'state');
}

function getBackupCollRef(uid: string) {
	return collection(db, 'users', uid, 'backups');
}

function getBackupDocRef(uid: string, backupId: string) {
	return doc(db, 'users', uid, 'backups', backupId);
}

function getLastSyncTime(): number {
	const raw = localStorage.getItem(CLOUD_SYNC_KEY);
	if (!raw) return 0;
	try {
		return JSON.parse(raw).updatedAt || 0;
	} catch {
		return 0;
	}
}

function setLastSyncTime(uid: string | null, updatedAt: number): void {
	localStorage.setItem(CLOUD_SYNC_KEY, JSON.stringify({ uid, updatedAt }));
}

function dispatchSyncEvent(status: string): void {
	try {
		window.dispatchEvent(new CustomEvent('sync-status', { detail: { status } }));
	} catch {
		// Silent fail if window is not available
	}
}

// ── Upload ─────────────────────────────────────────────────

/**
 * Upload current state to Firestore.
 */
export async function uploadState(uid: string): Promise<void> {
	const { getState } = await import('../state/store.svelte.js');
	const state = getState();

	const payload = {
		schemaVersion: 1,
		updatedAt: serverTimestamp(),
		_localUpdatedAt: Date.now(),
		deviceId: getDeviceId(),
		data: exportSyncState(state)
	};

	await setDoc(getDocRef(uid), payload);
	setLastSyncTime(uid, Date.now());
	dispatchSyncEvent('synced');
}

// ── Download ───────────────────────────────────────────────

/**
 * Download state from Firestore.
 */
export async function downloadState(uid: string): Promise<any | null> {
	const snap = await getDoc(getDocRef(uid));
	if (!snap.exists()) return null;

	const data = snap.data();
	return {
		...data,
		updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt ?? 0
	};
}

// ── Merge cloud into local ─────────────────────────────────

/**
 * Full sync flow: download from cloud and merge with local state.
 */
export async function downloadAndMergeState(uid: string): Promise<void> {
	try {
		dispatchSyncEvent('syncing');

		const cloudDoc = await downloadState(uid);

		if (!cloudDoc) {
			initialSyncDone = true;
			// Cloud empty → upload local
			await uploadState(uid);
			dispatchSyncEvent('synced');
			return;
		}

		const neverSynced = getLastSyncTime() === 0;

		if (neverSynced) {
			// First time syncing: cloud always wins (avoids sample data overwrite)
			const mod = await import('../state/store.svelte.js');
			mod.setRoutines(cloudDoc.data.routines || []);
			mod.setStats(cloudDoc.data.stats || {});
			mod.setSessions(cloudDoc.data.sessions || []);
			if (cloudDoc.data.currentRoutineId) {
				mod.setCurrentRoutineId(cloudDoc.data.currentRoutineId);
			}
			mod.saveData(true);
		} else {
			// Subsequent syncs: compare timestamps
			const mod = await import('../state/store.svelte.js');
			const localData = {
				_syncedAt: getLastSyncTime(),
				data: exportSyncState(mod.getState())
			};
			const result = mergeState(localData, cloudDoc);

			if (result.changed && result.data) {
				mod.setRoutines(result.data.routines);
				mod.setStats(result.data.stats);
				mod.setSessions(result.data.sessions);
				if (result.data.currentRoutineId) {
					mod.setCurrentRoutineId(result.data.currentRoutineId);
				}
				mod.saveData(true);
			}
		}

		setLastSyncTime(uid, cloudDoc.updatedAt || Date.now());
		initialSyncDone = true;
		dispatchSyncEvent('synced');
	} catch (err) {
		console.error('Sync download failed:', err);
		dispatchSyncEvent('error');
	}
}

// ── Immediate sync ─────────────────────────────────────────

/**
 * Immediate sync — no debounce, no toggle check.
 */
export async function syncNow(): Promise<void> {
	const { auth: firebaseAuth } = await import('./config.js');
	const user = firebaseAuth.currentUser;
	if (!user) return;
	dispatchSyncEvent('syncing');
	try {
		await uploadState(user.uid);
		dispatchSyncEvent('synced');
	} catch {
		dispatchSyncEvent('error');
	}
}

// ── Debounced sync ─────────────────────────────────────────

/**
 * Schedule a debounced cloud sync (2s delay).
 * Checks auto-sync toggle before uploading.
 */
export function scheduleCloudSync(): void {
	if (syncTimeout) clearTimeout(syncTimeout);
	syncTimeout = setTimeout(async () => {
		const autoToggle = document.getElementById('sync-auto-toggle') as HTMLInputElement | null;
		if (!autoToggle || !autoToggle.checked) return;

		const { auth: firebaseAuth } = await import('./config.js');
		const user = firebaseAuth.currentUser;
		if (user) {
			dispatchSyncEvent('syncing');
			try {
				await uploadState(user.uid);
				dispatchSyncEvent('synced');
			} catch {
				dispatchSyncEvent('error');
			}
		}
	}, 2000);
}

// ── Realtime listener ──────────────────────────────────────

/**
 * Start a realtime Firestore listener for remote changes.
 */
export function startSyncListener(
	uid: string,
	onRemoteChange: (data: SyncPayload) => void
): (() => void) | undefined {
	if (unsubscribeSnapshot) return;

	unsubscribeSnapshot = onSnapshot(getDocRef(uid), (snap) => {
		if (!snap.exists()) return;
		const data = snap.data();

		// Skip snapshots triggered by our own writes
		if (data.deviceId === getDeviceId()) return;

		// Skip initial snapshot — downloadAndMergeState handles first sync
		if (!initialSyncDone) return;

		const cloudTime = data.updatedAt?.toMillis?.() ?? data.updatedAt ?? 0;
		const localTime = getLastSyncTime();

		if (cloudTime > localTime) {
			const merged = importSyncState(data.data);
			if (onRemoteChange) onRemoteChange(merged);
			setLastSyncTime(null, cloudTime);
		}
	});

	return unsubscribeSnapshot;
}

/**
 * Stop the realtime listener.
 */
export function stopSyncListener(): void {
	if (unsubscribeSnapshot) {
		unsubscribeSnapshot();
		unsubscribeSnapshot = null;
	}
}

// ── Snapshots (manual backups in Firestore) ───────────────

/**
 * Save a backup snapshot to Firestore.
 */
export async function saveBackup(uid: string, label?: string): Promise<string> {
	const { getState } = await import('../state/store.svelte.js');
	const state = getState();
	const backupId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
	await setDoc(getBackupDocRef(uid, backupId), {
		createdAt: serverTimestamp(),
		label: label || `Copia ${new Date().toLocaleString()}`,
		data: exportSyncState(state)
	});
	return backupId;
}

/**
 * List all backups for a user.
 */
export async function listBackups(uid: string): Promise<
	Array<{ id: string; label: string; createdAt: number }>
> {
	const q = query(getBackupCollRef(uid), orderBy('createdAt', 'desc'));
	const snap = await getDocs(q);
	const backups: Array<{ id: string; label: string; createdAt: number }> = [];
	snap.forEach((d) => {
		const data = d.data();
		backups.push({
			id: d.id,
			label: data.label || '',
			createdAt: data.createdAt?.toMillis?.() || data.createdAt || 0
		});
	});
	return backups;
}

/**
 * Load a specific backup by ID.
 */
export async function loadBackup(uid: string, backupId: string): Promise<any | null> {
	const snap = await getDoc(getBackupDocRef(uid, backupId));
	if (!snap.exists()) return null;
	return { id: snap.id, ...snap.data() };
}

/**
 * Delete a specific backup by ID.
 */
export async function deleteBackup(uid: string, backupId: string): Promise<void> {
	await deleteDoc(getBackupDocRef(uid, backupId));
}
