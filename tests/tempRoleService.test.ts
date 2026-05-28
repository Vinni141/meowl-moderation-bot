import { describe, expect, it } from 'vitest';
import { isExpired } from '../src/services/tempRoleService.js';
import { getWarningExpiresAt } from '../src/services/moderationService.js';

describe('temp role expiry', () => {
  it('detects expired roles', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(isExpired(new Date('2025-12-31T23:59:59.000Z'), now)).toBe(true);
    expect(isExpired(new Date('2026-01-01T00:00:01.000Z'), now)).toBe(false);
  });
});

describe('warning expiry', () => {
  it('sets warnings to expire after 30 days', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(getWarningExpiresAt(now).toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });
});
