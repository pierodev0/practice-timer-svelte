import { nanoid } from 'nanoid';
import { format } from 'date-fns';
import type { Routine } from './types.js';

/**
 * Pure utility functions — no DOM, no state, no side effects.
 */

/**
 * Format seconds into MM:SS display string.
 */
export function formatTime(seconds: number): string {
	return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}

/**
 * Extract first URL from a text string.
 */
export function getFirstUrl(text: string): string | undefined {
	return (text.match(/(https?:\/\/[^\s]+)/i) || [])[0];
}

/**
 * Extract first image URL from a text string.
 */
export function getFirstImage(text: string): string | undefined {
	return (text.match(/(https?:\/\/[^\s]*\.(?:png|jpg|jpeg|gif|webp|svg)[^\s]*)/i) || [])[0];
}

/**
 * Generate a consistent color from a string (for chart datasets).
 */
export function stringToColor(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}
	return (
		'#' +
		'00000'.substring(0, 6 - ((hash & 0x00ffffff) >>> 0).toString(16).toUpperCase().length) +
		((hash & 0x00ffffff) >>> 0).toString(16).toUpperCase()
	);
}

/**
 * Trigger a file download in the browser.
 */
export function downloadJSON(content: string, filename: string): void {
	const a = document.createElement('a');
	a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
	a.download = filename;
	a.click();
	URL.revokeObjectURL(a.href);
}

/**
 * Sanitize an imported routine (ensure all fields exist).
 */
export function sanitizeImportedRoutine(r: Record<string, unknown>): Routine {
	return {
		id: nanoid(),
		name: (r.name as string) + ' (Import)',			exercises: ((r.exercises as Array<Record<string, unknown>>) || []).map((ex) => ({
			id: nanoid(),
			title: (ex.title as string) || 'Untitled',
			bpm: (ex.bpm as number) || 100,
			durationSec: (ex.durationSec as number) || 60,
			remainingSec: (ex.durationSec as number) || 60,
			completed: false,
			autoStart: (ex.autoStart as boolean) ?? true,
			archived: !!ex.archived,
			reps: (ex.reps as number) || 1,
			currentRep: 1,
			comment: (ex.comment as string) || '',
			statisticName: (ex.statisticName as string | null) || null,
			statisticLogs: (ex.statisticLogs as Array<{ date: string; value: number; sessionId?: string }>) || []
		}))
	};
}

/**
 * Create today's date string in YYYY-MM-DD format.
 */
export function formatDate(date: Date): string {
	return format(date, 'yyyy-MM-dd');
}

export function todayStr(): string {
	return formatDate(new Date());
}

/**
 * Simple deep clone via JSON (safe for serializable data).
 */
export function deepClone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}

/**
 * Format an ISO datetime string to "h:mm a.m/p.m" (e.g. "12:03 a.m").
 */
export function formatISOTime(isoStr: string | null | undefined): string {
	if (!isoStr) return '--:--';
	const d = new Date(isoStr);
	if (isNaN(d.getTime())) return '--:--';
	let h = d.getHours();
	const m = d.getMinutes().toString().padStart(2, '0');
	const ampm = h < 12 ? 'a.m' : 'p.m';
	h = h % 12 || 12;
	return `${h}:${m} ${ampm}`;
}

/**
 * Convert seconds to whole minutes (rounded).
 */
export function secToMin(sec: number): number {
	return Math.round((sec || 0) / 60);
}
