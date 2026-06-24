import { describe, expect, it } from 'vitest';
import { DISCORD_TIMEOUT_MAX_MS, isDurationInput, parseDuration } from '../src/services/durationService.js';

describe('parseDuration', () => {
  it('parses supported units', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(parseDuration('10s', undefined, now).milliseconds).toBe(10_000);
    expect(parseDuration('10sec', undefined, now).milliseconds).toBe(10_000);
    expect(parseDuration('5m', undefined, now).milliseconds).toBe(300_000);
    expect(parseDuration('1min', undefined, now).milliseconds).toBe(60_000);
    expect(parseDuration('2h', undefined, now).milliseconds).toBe(7_200_000);
    expect(parseDuration('7d', undefined, now).expiresAt.toISOString()).toBe('2026-01-08T00:00:00.000Z');
  });

  it('detects duration inputs before parsing commands', () => {
    expect(isDurationInput('10sec')).toBe(true);
    expect(isDurationInput('1min')).toBe(true);
    expect(isDurationInput('reason')).toBe(false);
  });

  it('rejects invalid and too large values', () => {
    expect(() => parseDuration('-1m')).toThrow();
    expect(() => parseDuration('0m')).toThrow();
    expect(() => parseDuration('5w')).toThrow();
    expect(() => parseDuration('29d', DISCORD_TIMEOUT_MAX_MS)).toThrow();
  });
});
