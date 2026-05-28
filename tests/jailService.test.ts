import { describe, expect, it } from 'vitest';
import { filterRemovableJailRoles } from '../src/services/jailService.js';

function role(id: string, position: number, managed = false) {
  return { id, position, managed, guild: { id: 'guild' } } as any;
}

describe('filterRemovableJailRoles', () => {
  it('keeps everyone, jail, managed and too-high roles out of removable roles', () => {
    const bot = {
      id: 'bot',
      guild: { ownerId: 'owner' },
      roles: {
        highest: {
          comparePositionTo(target: { position: number }) {
            return 10 - target.position;
          },
        },
      },
    } as any;
    const result = filterRemovableJailRoles(
      [role('guild', 0), role('jail', 1), role('normal', 2), role('managed', 2, true), role('high', 12)],
      bot,
      'jail',
    );
    expect(result.removable.map((item) => item.id)).toEqual(['normal']);
    expect(result.failed.map((item) => item.id)).toEqual(['high']);
  });
});
