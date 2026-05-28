import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import { prisma } from '../database/prisma.js';

export async function setAfk(member: GuildMember, reason?: string): Promise<void> {
  const oldNickname = member.nickname ?? null;
  await prisma.afkStatus.upsert({
    where: { guildId_userId: { guildId: member.guild.id, userId: member.id } },
    update: { reason, oldNickname },
    create: { guildId: member.guild.id, userId: member.id, reason, oldNickname },
  });

  const me = await member.guild.members.fetchMe();
  if (me.permissions.has(PermissionFlagsBits.ManageNicknames) && member.manageable) {
    const base = member.displayName.replace(/^\[AFK\]\s*/i, '');
    await member.setNickname(`[AFK] ${base}`.slice(0, 32)).catch(() => null);
  }
}

export type ClearedAfkStatus = {
  reason: string | null;
  createdAt: Date;
};

export async function clearAfk(member: GuildMember): Promise<ClearedAfkStatus | null> {
  const status = await prisma.afkStatus.findUnique({
    where: { guildId_userId: { guildId: member.guild.id, userId: member.id } },
  });
  if (!status) return null;
  await prisma.afkStatus.delete({ where: { id: status.id } });

  const me = await member.guild.members.fetchMe();
  if (me.permissions.has(PermissionFlagsBits.ManageNicknames) && member.manageable) {
    await member.setNickname(status.oldNickname).catch(() => null);
  }
  return { reason: status.reason, createdAt: status.createdAt };
}

export async function getAfk(guildId: string, userId: string) {
  return prisma.afkStatus.findUnique({ where: { guildId_userId: { guildId, userId } } });
}

export function formatAfkDuration(from: Date, to = new Date()): string {
  const totalSeconds = Math.max(1, Math.floor((to.getTime() - from.getTime()) / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    [days, 'day'],
    [hours, 'hour'],
    [minutes, 'minute'],
    [seconds, 'second'],
  ]
    .filter(([value]) => Number(value) > 0)
    .slice(0, 2)
    .map(([value, label]) => `${value} ${label}${value === 1 ? '' : 's'}`);

  if (parts.length === 1) return parts[0] ?? '1 second';
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}
