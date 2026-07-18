import { describe, it, expect, vi } from 'vitest';

// Mock nanoid so IDs are deterministic in tests
vi.mock('nanoid', () => ({
	nanoid: () => 'test-id-123'
}));

// Mock date-fns so formatDate/todayStr are deterministic
vi.mock('date-fns', () => ({
	format: (date: Date, fmt: string) => {
		if (fmt === 'yyyy-MM-dd') {
			return '2026-07-18';
		}
		return String(date);
	}
}));

const {
	formatTime,
	getFirstUrl,
	getFirstImage,
	stringToColor,
	sanitizeImportedRoutine,
	todayStr,
	deepClone,
	formatISOTime,
	secToMin
} = await import('./utils.js');

// ============================================================
// formatTime
// ============================================================
describe('formatTime', () => {
	it('formats 0 seconds as "0:00"', () => {
		expect(formatTime(0)).toBe('0:00');
	});

	it('formats seconds under 60', () => {
		expect(formatTime(45)).toBe('0:45');
		expect(formatTime(5)).toBe('0:05');
		expect(formatTime(59)).toBe('0:59');
	});

	it('formats exact minutes', () => {
		expect(formatTime(60)).toBe('1:00');
		expect(formatTime(300)).toBe('5:00');
		expect(formatTime(3600)).toBe('60:00');
	});

	it('formats minutes and seconds', () => {
		expect(formatTime(90)).toBe('1:30');
		expect(formatTime(185)).toBe('3:05');
		expect(formatTime(3661)).toBe('61:01');
	});

	it('handles negative values (JS Math.floor behavior)', () => {
		expect(formatTime(-1)).toBe('-1:-1');
	});

	it('handles large values', () => {
		const result = formatTime(999999);
		expect(result).toMatch(/^\d+:\d{2}$/);
	});
});

// ============================================================
// getFirstUrl
// ============================================================
describe('getFirstUrl', () => {
	it('returns first URL from text', () => {
		const text = 'Check this https://example.com/page and also http://test.com';
		expect(getFirstUrl(text)).toBe('https://example.com/page');
	});

	it('returns first http URL when no https', () => {
		const text = 'Visit http://example.com for info';
		expect(getFirstUrl(text)).toBe('http://example.com');
	});

	it('returns undefined when no URL present', () => {
		expect(getFirstUrl('just plain text')).toBeUndefined();
		expect(getFirstUrl('')).toBeUndefined();
	});

	it('handles URLs with paths and query params', () => {
		const text = 'See https://example.com/path?q=test&x=1 for details';
		expect(getFirstUrl(text)).toBe('https://example.com/path?q=test&x=1');
	});
});

// ============================================================
// getFirstImage
// ============================================================
describe('getFirstImage', () => {
	it('returns first image URL from text', () => {
		const text = 'Image: https://example.com/photo.png and https://test.com/img.jpg';
		expect(getFirstImage(text)).toBe('https://example.com/photo.png');
	});

	it('matches common image extensions', () => {
		const cases = [
			['https://example.com/img.jpg', 'jpg'],
			['https://example.com/img.jpeg', 'jpeg'],
			['https://example.com/img.png', 'png'],
			['https://example.com/img.gif', 'gif'],
			['https://example.com/img.webp', 'webp'],
			['https://example.com/img.svg', 'svg']
		];
		for (const [url] of cases) {
			expect(getFirstImage(`Here: ${url}`)).toBe(url);
		}
	});

	it('returns undefined when no image URL', () => {
		expect(getFirstImage('just text')).toBeUndefined();
		expect(getFirstImage('https://example.com/page')).toBeUndefined();
		expect(getFirstImage('')).toBeUndefined();
	});
});

// ============================================================
// stringToColor (hash-based, deterministic)
// ============================================================
describe('stringToColor', () => {
	it('returns a valid hex color string', () => {
		const color = stringToColor('Module 1');
		expect(color).toMatch(/^#[0-9A-F]{6}$/);
	});

	it('returns deterministic results', () => {
		expect(stringToColor('Module 1')).toBe(stringToColor('Module 1'));
		expect(stringToColor('test')).toBe(stringToColor('test'));
	});

	it('returns different colors for different inputs', () => {
		const c1 = stringToColor('Module 1');
		const c2 = stringToColor('Module 2');
		expect(c1).not.toBe(c2);
	});

	it('handles empty string', () => {
		const color = stringToColor('');
		expect(color).toMatch(/^#[0-9A-F]{6}$/);
	});

	it('handles long strings', () => {
		const color = stringToColor('a'.repeat(100));
		expect(color).toMatch(/^#[0-9A-F]{6}$/);
	});
});

// ============================================================
// sanitizeImportedRoutine
// ============================================================
describe('sanitizeImportedRoutine', () => {
	it('normalizes a minimal routine with defaults', () => {
		const result = sanitizeImportedRoutine({ name: 'Test Routine' });
		expect(result).toEqual({
			id: 'test-id-123',
			name: 'Test Routine (Import)',
			exercises: []
		});
	});

	it('normalizes exercises with all defaults', () => {
		const result = sanitizeImportedRoutine({
			name: 'My Routine',
			exercises: [{ title: 'Exercise 1' }]
		});
		expect(result.exercises).toHaveLength(1);
		const ex = result.exercises[0];
		expect(ex).toMatchObject({
			title: 'Exercise 1',
			bpm: 100,
			durationSec: 60,
			remainingSec: 60,
			completed: false,
			autoStart: true,
			archived: false,
			reps: 1,
			currentRep: 1,
			comment: '',
			statisticName: null,
			statisticLogs: []
		});
		expect(ex.id).toBe('test-id-123');
	});

	it('preserves provided exercise values', () => {
		const result = sanitizeImportedRoutine({
			name: 'Advanced',
			exercises: [
				{
					title: 'Scales',
					bpm: 120,
					durationSec: 300,
					reps: 3,
					statisticName: 'BPM',
					comment: 'Focus on accuracy'
				}
			]
		});
		const ex = result.exercises[0];
		expect(ex.title).toBe('Scales');
		expect(ex.bpm).toBe(120);
		expect(ex.durationSec).toBe(300);
		expect(ex.remainingSec).toBe(300);
		expect(ex.reps).toBe(3);
		expect(ex.comment).toBe('Focus on accuracy');
		expect(ex.statisticName).toBe('BPM');
	});

	it('marks exercises as archived when explicitly set', () => {
		const result = sanitizeImportedRoutine({
			name: 'R',
			exercises: [{ title: 'Old', archived: true }]
		});
		expect(result.exercises[0].archived).toBe(true);
	});

	it('handles an explicit false for autoStart', () => {
		const result = sanitizeImportedRoutine({
			name: 'R',
			exercises: [{ title: 'Ex', autoStart: false }]
		});
		expect(result.exercises[0].autoStart).toBe(false);
	});

	it('handles array input by wrapping in an array check (the function wraps single obj)', () => {
		const result = sanitizeImportedRoutine({
			name: 'Single',
			exercises: []
		});
		expect(result.name).toBe('Single (Import)');
	});
});

// ============================================================
// todayStr
// ============================================================
describe('todayStr', () => {
	it('returns mocked date YYYY-MM-DD', () => {
		expect(todayStr()).toBe('2026-07-18');
	});
});

// ============================================================
// deepClone
// ============================================================
describe('deepClone', () => {
	it('clones a plain object', () => {
		const obj = { a: 1, b: 'hello', c: true };
		const cloned = deepClone(obj);
		expect(cloned).toEqual(obj);
		expect(cloned).not.toBe(obj);
	});

	it('clones nested objects', () => {
		const obj = { a: { b: { c: [1, 2, 3] } } };
		const cloned = deepClone(obj);
		expect(cloned).toEqual(obj);
		cloned.a.b.c.push(4);
		expect(obj.a.b.c).toHaveLength(3); // original unchanged
	});

	it('clones arrays', () => {
		const arr = [{ id: 1 }, { id: 2 }];
		const cloned = deepClone(arr);
		expect(cloned).toEqual(arr);
		expect(cloned).not.toBe(arr);
	});

	it('handles null', () => {
		expect(deepClone(null)).toBeNull();
	});

	it('handles primitive values', () => {
		expect(deepClone(42)).toBe(42);
		expect(deepClone('hello')).toBe('hello');
		expect(deepClone(true)).toBe(true);
	});

	it('rejects undefined (JSON limitation)', () => {
		expect(() => deepClone(undefined)).toThrow();
	});
});

// ============================================================
// formatISOTime
// ============================================================
describe('formatISOTime', () => {
	it('formats morning time correctly', () => {
		const result = formatISOTime('2026-07-18T08:30:00');
		expect(result).toBe('8:30 a.m');
	});

	it('formats afternoon time correctly', () => {
		const result = formatISOTime('2026-07-18T14:30:00');
		expect(result).toBe('2:30 p.m');
	});

	it('formats midnight as 12:00 a.m', () => {
		const result = formatISOTime('2026-07-18T00:00:00');
		expect(result).toBe('12:00 a.m');
	});

	it('formats noon as 12:00 p.m', () => {
		const result = formatISOTime('2026-07-18T12:00:00');
		expect(result).toBe('12:00 p.m');
	});

	it('returns --:-- for null/undefined', () => {
		expect(formatISOTime(null)).toBe('--:--');
		expect(formatISOTime(undefined)).toBe('--:--');
	});

	it('returns --:-- for invalid date string', () => {
		expect(formatISOTime('not-a-date')).toBe('--:--');
	});

	it('formats with single-digit hour padding', () => {
		const result = formatISOTime('2026-07-18T09:05:00');
		expect(result).toBe('9:05 a.m');
	});
});

// ============================================================
// secToMin
// ============================================================
describe('secToMin', () => {
	it('converts seconds to whole minutes (rounded)', () => {
		expect(secToMin(0)).toBe(0);
		expect(secToMin(60)).toBe(1);
		expect(secToMin(90)).toBe(2);
		expect(secToMin(30)).toBe(1);
		expect(secToMin(3600)).toBe(60);
	});

	it('handles undefined/null/NaN gracefully', () => {
		expect(secToMin(undefined as unknown as number)).toBe(0);
		expect(secToMin(null as unknown as number)).toBe(0);
	});
});
