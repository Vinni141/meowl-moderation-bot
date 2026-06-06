import type { Client } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { dmModerationEmbed } from './embedService.js';
import { unjailUser } from './jailService.js';
import { logModerationAction } from './logService.js';
import { DISCORD_TIMEOUT_MAX_MS } from './durationService.js';
import { PERMANENT_MUTE_EXPIRES_AT } from './moderationService.js';
import { expireTempRole } from './tempRoleService.js';

const permanentMuteRefreshThresholdMs = 24 * 60 * 60 * 1000;

export async function processExpiredItems(client: Client): Promise<void> {
  const now = new Date();

  const tempRoles = await prisma.tempRole.findMany({ where: { active: true, expiresAt: { lte: now } } });
  for (const tempRole of tempRoles) {
    const guild = await client.guilds.fetch(tempRole.guildId).catch(() => null);
    if (guild) await expireTempRole(guild, tempRole.id);
  }

  const jails = await prisma.jail.findMany({
    where: { active: true, expiresAt: { not: null, lte: now } },
  });
  for (const jail of jails) {
    const guild = await client.guilds.fetch(jail.guildId).catch(() => null);
    const member = guild ? await guild.members.fetch(jail.userId).catch(() => null) : null;
    if (guild && member) await unjailUser(guild, member, 'SYSTEM', 'Jail duration expired');
  }

  const mutes = await prisma.mute.findMany({ where: { active: true, expiresAt: { lte: now } } });
  for (const mute of mutes) {
    await prisma.mute.update({ where: { id: mute.id }, data: { active: false } });
    const guild = await client.guilds.fetch(mute.guildId).catch(() => null);
    if (guild) {
      const member = await guild.members.fetch(mute.userId).catch(() => null);
      await member
        ?.send({ embeds: [dmModerationEmbed('You got unmuted', 'Expired', guild)] })
        .catch(() => null);
      await logModerationAction({
        guild,
        action: 'MUTE_EXPIRED',
        targetUserId: mute.userId,
        reason: 'Mute duration expired',
      });
    }
  }

  const permanentMutes = await prisma.mute.findMany({
    where: { active: true, expiresAt: PERMANENT_MUTE_EXPIRES_AT },
  });
  for (const mute of permanentMutes) {
    const guild = await client.guilds.fetch(mute.guildId).catch(() => null);
    const member = guild ? await guild.members.fetch(mute.userId).catch(() => null) : null;
    if (!member) continue;

    const timeoutUntil = member.communicationDisabledUntilTimestamp ?? 0;
    const shouldRefresh = timeoutUntil - now.getTime() <= permanentMuteRefreshThresholdMs;
    if (shouldRefresh) {
      await member.timeout(DISCORD_TIMEOUT_MAX_MS, mute.reason).catch((error) => {
        console.error('Failed to refresh permanent mute timeout:', error);
      });
    }
  }

  const warnings = await prisma.warning.findMany({ where: { active: true, expiresAt: { lte: now } } });
  for (const warning of warnings) {
    await prisma.warning.update({ where: { id: warning.id }, data: { active: false } });
    const guild = await client.guilds.fetch(warning.guildId).catch(() => null);
    if (guild) {
      await logModerationAction({
        guild,
        action: 'WARNING_EXPIRED',
        targetUserId: warning.userId,
        reason: 'Warning expired after 30 days',
      });
    }
  }
}

export function startScheduler(client: Client): NodeJS.Timeout {
  void processExpiredItems(client);
  return setInterval(() => void processExpiredItems(client), 60_000);
}
