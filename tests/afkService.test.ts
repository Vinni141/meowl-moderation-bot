import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, any>();

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    afkStatus: {
      upsert: vi.fn(async ({ where, create, update }) => {
        const key = `${where.guildId_userId.guildId}:${where.guildId_userId.userId}`;
        const value = { id: key, ...create, ...update };
        store.set(key, value);
        return value;
      }),
      findUnique: vi.fn(async ({ where }) => store.get(`${where.guildId_userId.guildId}:${where.guildId_userId.userId}`) ?? null),
      delete: vi.fn(async ({ where }) => {
        store.delete(where.id);
      }),
    },
  },
}));

describe('afk status logic', () => {
  beforeEach(() => store.clear());

  it('sets and clears AFK status', async () => {
    const { setAfk, clearAfk, getAfk } = await import('../src/services/afkService.js');
    const member = {
      id: 'u1',
      nickname: 'Vincent',
      displayName: 'Vincent',
      manageable: false,
      guild: { id: 'g1', members: { fetchMe: async () => ({ permissions: { has: () => false } }) } },
    } as any;

    await setAfk(member, 'busy');
    expect(await getAfk('g1', 'u1')).toMatchObject({ reason: 'busy' });
    expect(await clearAfk(member)).toMatchObject({ reason: 'busy' });
    expect(await getAfk('g1', 'u1')).toBeNull();
  });
});
