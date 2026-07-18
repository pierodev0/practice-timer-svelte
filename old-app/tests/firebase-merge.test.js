import { describe, it, expect, vi } from 'vitest';

// mock deepClone for simplicity (it's tested in utils.test.js)
vi.mock('../js/utils.js', () => ({
  deepClone: (obj) => JSON.parse(JSON.stringify(obj)),
}));

import { mergeState } from '../js/firebase/merge.js';

describe('mergeState', () => {
  it('returns cloud data when local is null', () => {
    const cloud = { data: { routines: [], stats: {} } };
    const result = mergeState(null, cloud);
    expect(result.changed).toBe(true);
    expect(result.data).toEqual(cloud.data);
  });

  it('returns no change when cloud is null', () => {
    const local = { _syncedAt: 100 };
    const result = mergeState(local, null);
    expect(result.changed).toBe(false);
    expect(result.data).toBeNull();
  });

  it('returns no change when both are null', () => {
    const result = mergeState(null, null);
    expect(result.changed).toBe(false);
    expect(result.data).toBeNull();
  });

  it('cloud wins when local has never synced (syncedAt === 0)', () => {
    const local = { _syncedAt: 0 };
    const cloud = {
      updatedAt: 5000,
      data: { routines: [{ id: 'r1' }], stats: { day1: { totalSec: 100 } } },
    };
    const result = mergeState(local, cloud);
    expect(result.changed).toBe(true);
    expect(result.data).toEqual(cloud.data);
  });

  it('cloud wins when cloud time > local time', () => {
    const local = { _syncedAt: 100 };
    const cloud = {
      updatedAt: 200,
      data: { routines: [{ id: 'cloud-routine' }] },
    };
    const result = mergeState(local, cloud);
    expect(result.changed).toBe(true);
    expect(result.data.routines[0].id).toBe('cloud-routine');
  });

  it('local wins when local time > cloud time', () => {
    const local = { _syncedAt: 200 };
    const cloud = {
      updatedAt: 100,
      data: { routines: [{ id: 'cloud-routine' }] },
    };
    const result = mergeState(local, cloud);
    expect(result.changed).toBe(false);
    expect(result.data).toBeNull();
  });

  it('local wins when times are equal', () => {
    const local = { _syncedAt: 100 };
    const cloud = {
      updatedAt: 100,
      data: { routines: [{ id: 'cloud-routine' }] },
    };
    const result = mergeState(local, cloud);
    expect(result.changed).toBe(false);
    expect(result.data).toBeNull();
  });

  it('handles cloud updatedAt as Firestore Timestamp with toMillis()', () => {
    const local = { _syncedAt: 100 };
    const cloud = {
      updatedAt: { toMillis: () => 200 },
      data: { routines: [{ id: 'r1' }] },
    };
    const result = mergeState(local, cloud);
    expect(result.changed).toBe(true);
  });

  it('handles cloud updatedAt as Firestore Timestamp with null data', () => {
    const local = { _syncedAt: 0 };
    const cloud = {
      updatedAt: { toMillis: () => 500 },
      data: { routines: [{ id: 'r1' }] },
    };
    const result = mergeState(local, cloud);
    expect(result.changed).toBe(true);
    expect(result.data.routines[0].id).toBe('r1');
  });

  it('deep clones cloud data when returning it', () => {
    const cloudData = { routines: [{ id: 'r1', exercises: [{ id: 'ex1' }] }] };
    const cloud = {
      updatedAt: 200,
      data: cloudData,
    };
    const local = { _syncedAt: 100 };

    const result = mergeState(local, cloud);
    
    // Modify the returned data
    result.data.routines[0].exercises[0].id = 'modified';
    
    // Original should be unchanged
    expect(cloudData.routines[0].exercises[0].id).toBe('ex1');
  });
});
