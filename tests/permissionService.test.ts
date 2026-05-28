import { describe, expect, it } from 'vitest';
import { canManageMember, canManageRole, isManagedRole } from '../src/services/permissionService.js';

function member(id: string, highestPosition: number, ownerId = 'owner') {
  return {
    id,
    guild: { ownerId },
    roles: {
      highest: {
        comparePositionTo(other: { position: number }) {
          return highestPosition - other.position;
        },
        position: highestPosition,
      },
    },
  } as any;
}

describe('permissionService hierarchy checks', () => {
  it('allows higher members to manage lower members', () => {
    expect(canManageMember(member('mod', 10), member('target', 5))).toBe(true);
    expect(canManageMember(member('mod', 5), member('target', 5))).toBe(false);
  });

  it('rejects managed roles', () => {
    expect(isManagedRole({ managed: true } as any)).toBe(true);
    expect(canManageRole(member('mod', 10), { managed: true, id: 'r1', guild: { id: 'g1' } } as any)).toBe(false);
  });
});
