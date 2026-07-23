import { describe, it, expect } from 'vitest';
import { formatTime } from '../lib/formatTime';

describe('formatTime Function (Original Code)', () => {
  it('formats valid seconds into MM:SS correctly', () => {
    expect(formatTime(125)).toBe('02:05');
    expect(formatTime(60)).toBe('01:00');
    expect(formatTime(9)).toBe('00:09');
  });

  it('returns 00:00 for invalid, negative, or NaN inputs', () => {
    expect(formatTime(-10)).toBe('00:00');
    expect(formatTime('abc')).toBe('00:00');
    expect(formatTime(NaN)).toBe('00:00');
  });

  it('handles decimal numbers correctly by flooring', () => {
    expect(formatTime(65.8)).toBe('01:05');
    expect(formatTime(120.9)).toBe('02:00');
  });
});