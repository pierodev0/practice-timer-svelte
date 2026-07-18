const STORAGE_KEY = 'music-device-id';

/**
 * Get or create a persistent device ID stored in localStorage.
 */
export function getDeviceId(): string {
	let id = localStorage.getItem(STORAGE_KEY);
	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem(STORAGE_KEY, id);
	}
	return id;
}
