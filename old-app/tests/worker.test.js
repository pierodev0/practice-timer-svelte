import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

let onmessageHandler;

// Load the worker module once, capture the onmessage handler it sets on self
beforeAll(async () => {
  // Create a temporary self for the module to attach to
  const tempSelf = { onmessage: null, postMessage: vi.fn() };
  vi.stubGlobal('self', tempSelf);
  await import('../js/worker.js');
  onmessageHandler = tempSelf.onmessage;
  vi.unstubAllGlobals();
});

describe('worker.js handler', () => {
  let postMessage;

  beforeEach(() => {
    postMessage = vi.fn();
    vi.stubGlobal('self', {
      onmessage: onmessageHandler,
      postMessage,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Stop any lingering interval before cleaning up
    try { self.onmessage({ data: 'stop' }); } catch (_) {}
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts ticking on "start" message', () => {
    self.onmessage({ data: 'start' });
    vi.advanceTimersByTime(1000);
    expect(postMessage).toHaveBeenCalledWith('tick');
  });

  it('ticks repeatedly every second', () => {
    self.onmessage({ data: 'start' });
    vi.advanceTimersByTime(3000);
    expect(postMessage).toHaveBeenCalledTimes(3);
  });

  it('stops ticking on "stop" message', () => {
    self.onmessage({ data: 'start' });
    vi.advanceTimersByTime(2000);
    self.onmessage({ data: 'stop' });
    postMessage.mockClear();

    vi.advanceTimersByTime(3000);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('ignores duplicate "start" (no double interval)', () => {
    self.onmessage({ data: 'start' });
    self.onmessage({ data: 'start' }); // second start — no-op
    vi.advanceTimersByTime(2000);
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  it('can restart after being stopped', () => {
    self.onmessage({ data: 'start' });
    vi.advanceTimersByTime(1000);

    self.onmessage({ data: 'stop' });
    vi.advanceTimersByTime(1000);

    self.onmessage({ data: 'start' });
    vi.advanceTimersByTime(2000);

    // 1 tick from first run + 2 ticks from restart
    expect(postMessage).toHaveBeenCalledTimes(3);
  });
});
