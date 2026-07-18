/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

let onmessageHandler: ((e: MessageEvent) => void) | null;

// Load the worker module once, capture the onmessage handler it sets on self
beforeAll(async () => {
	const tempSelf: { onmessage: null | ((e: MessageEvent) => void); postMessage: ReturnType<typeof vi.fn> } =
		{ onmessage: null, postMessage: vi.fn() };
	vi.stubGlobal('self', tempSelf);
	await import('./worker.js');
	onmessageHandler = tempSelf.onmessage;
	vi.unstubAllGlobals();
});

describe('worker.js handler', () => {
	let postMessage: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		postMessage = vi.fn();
		vi.stubGlobal('self', {
			onmessage: onmessageHandler,
			postMessage
		});
		vi.useFakeTimers();
	});

	afterEach(() => {
		// Stop any lingering interval before cleaning up
		try {
			(self as any).onmessage({ data: 'stop' });
		} catch (_) {}
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('starts ticking on "start" message', () => {
		(self as any).onmessage({ data: 'start' });
		vi.advanceTimersByTime(1000);
		expect(postMessage).toHaveBeenCalledWith('tick');
	});

	it('ticks repeatedly every second', () => {
		(self as any).onmessage({ data: 'start' });
		vi.advanceTimersByTime(3000);
		expect(postMessage).toHaveBeenCalledTimes(3);
	});

	it('stops ticking on "stop" message', () => {
		(self as any).onmessage({ data: 'start' });
		vi.advanceTimersByTime(2000);
		(self as any).onmessage({ data: 'stop' });
		postMessage.mockClear();

		vi.advanceTimersByTime(3000);
		expect(postMessage).not.toHaveBeenCalled();
	});

	it('ignores duplicate "start" (no double interval)', () => {
		(self as any).onmessage({ data: 'start' });
		(self as any).onmessage({ data: 'start' }); // second start — no-op
		vi.advanceTimersByTime(2000);
		expect(postMessage).toHaveBeenCalledTimes(2);
	});

	it('can restart after being stopped', () => {
		(self as any).onmessage({ data: 'start' });
		vi.advanceTimersByTime(1000);

		(self as any).onmessage({ data: 'stop' });
		vi.advanceTimersByTime(1000);

		(self as any).onmessage({ data: 'start' });
		vi.advanceTimersByTime(2000);

		// 1 tick from first run + 2 ticks from restart
		expect(postMessage).toHaveBeenCalledTimes(3);
	});
});
