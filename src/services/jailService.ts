import { ChannelType, PermissionFlagsBits, type Guild, type GuildMember, type Role, type TextChannel } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { ModerationActionError, NotFoundError, UserInputError } from '../lib/errors.js';
import { parseDuration } from './durationService.js';
import { logModerationAction } from './logService.js';
import {
  canManageRole,
  ensureBotHasPermission,
  ensureModeratorHasPermission,
  ensureRoleManageableByBot,
  ensureTargetManageable,
} from './permissionService.js';

export function filterRemovableJailRoles(
  roles: Role[],
  bot: GuildMember,
  jailRoleId: string,
): { removable: Role[]; failed: Role[] } {
  const candidates = roles.filter((role) => role.id !== role.guild.id && role.id !== jailRoleId && !role.managed);
  return {
    removable: candidates.filter((role) => canManageRole(bot, role)),
    failed: candidates.filter((role) => !canManageRole(bot, role)),
  };
}

export async function setupJail(
  moderator: GuildMember,
  jailRole: Role,
  jailChannel: TextChannel,
): Promise<{ updatedChannels: number; failedChannels: string[]; caseId: number }> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ManageGuild);
  const bot = await moderator.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ManageRoles);
  ensureBotHasPermission(bot, PermissionFlagsBits.ManageChannels);
  ensureRoleManageableByBot(bot, jailRole);

  await prisma.guildSettings.upsert({
    where: { guildId: moderator.guild.id },
    update: { jailRoleId: jailRole.id, jailChannelId: jailChannel.id },
    create: { guildId: moderator.guild.id, jailRoleId: jailRole.id, jailChannelId: jailChannel.id },
  });

  const failedChannels: string[] = [];
  let updatedChannels = 0;
  const channels = await moderator.guild.channels.fetch();
  for (const channel of channels.values()) {
    if (!channel || !('permissionOverwrites' in channel)) continue;
    try {
      if (channel.id === jailChannel.id) {
        await channel.permissionOverwrites.edit(jailRole, {
          ViewChannel: true,
          SendMessages: true,
          AddReactions: true,
          ReadMessageHistory: true,
        });
      } else {
        await channel.permissionOverwrites.edit(jailRole, {
          ViewChannel: false,
          SendMessages: false,
          AddReactions: false,
          Connect: false,
          Speak: false,
          Stream: false,
        });
      }
      updatedChannels += 1;
    } catch {
      failedChannels.push(channel.id);
    }
  }

  const caseId = await logModerationAction({
    guild: moderator.guild,
    action: 'JAIL_SETUP',
    moderatorId: moderator.id,
    channelId: jailChannel.id,
    metadata: { jailRoleId: jailRole.id, failedChannels },
  });
  return { updatedChannels, failedChannels, caseId };
}

export async function jailUser(
  moderator: GuildMember,
  target: GuildMember,
  reason: string,
  durationInput?: string,
): Promise<{ caseId: number; failedRemovedRoleIds: string[] }> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ManageRoles);
  const bot = await target.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ManageRoles);
  ensureTargetManageable(moderator, bot, target, bot.id);

  const settings = await prisma.guildSettings.findUnique({ where: { guildId: target.guild.id } });
  if (!settings?.jailRoleId || !settings.jailChannelId) {
    throw new NotFoundError('Jail is not configured. Use /jailsetup first.');
  }

  const existing = await prisma.jail.findFirst({
    where: { guildId: target.guild.id, userId: target.id, active: true },
  });
  if (existing) throw new UserInputError('This user is already jailed.');

  const jailRole = await target.guild.roles.fetch(settings.jailRoleId);
  const jailChannel = await target.guild.channels.fetch(settings.jailChannelId);
  if (!jailRole || !jailChannel || jailChannel.type !== ChannelType.GuildText) {
    throw new NotFoundError('The jail role or jail channel no longer exists.');
  }
  ensureRoleManageableByBot(bot, jailRole);

  const duration = durationInput ? parseDuration(durationInput) : undefined;
  const previousRoleIds = target.roles.cache.filter((role) => role.id !== target.guild.id).map((role) => role.id);
  const { removable, failed } = filterRemovableJailRoles([...target.roles.cache.values()], bot, jailRole.id);

  const removedRoleIds: string[] = [];
  try {
    for (const role of removable) {
      await target.roles.remove(role, reason);
      removedRoleIds.push(role.id);
    }
    await target.roles.add(jailRole, reason);
  } catch {
    for (const roleId of removedRoleIds) {
      const role = await target.guild.roles.fetch(roleId).catch(() => null);
      if (role && canManageRole(bot, role)) await target.roles.add(role).catch(() => null);
    }
    throw new ModerationActionError(
      'Jail could not be completed. Removed roles were restored where possible.',
    );
  }

  await prisma.jail.create({
    data: {
      guildId: target.guild.id,
      userId: target.id,
      moderatorId: moderator.id,
      reason,
      previousRoleIds: JSON.stringify(previousRoleIds),
      failedRemovedRoleIds: JSON.stringify(failed.map((role) => role.id)),
      jailRoleId: jailRole.id,
      jailChannelId: jailChannel.id,
      expiresAt: duration?.expiresAt,
    },
  });

  const caseId = await logModerationAction({
    guild: target.guild,
    action: 'JAIL',
    targetUserId: target.id,
    moderatorId: moderator.id,
    reason,
    duration: duration?.input,
    channelId: jailChannel.id,
    metadata: { failedRemovedRoleIds: failed.map((role) => role.id) },
  });

  return { caseId, failedRemovedRoleIds: failed.map((role) => role.id) };
}

export async function autoJailMember(
  target: GuildMember,
  reason: string,
): Promise<{ caseId: number; failedRemovedRoleIds: string[] } | null> {
  const bot = await target.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ManageRoles);

  if (target.id === bot.id || target.guild.ownerId === target.id) return null;
  const settings = await prisma.guildSettings.findUnique({ where: { guildId: target.guild.id } });
  if (!settings?.jailRoleId || !settings.jailChannelId) return null;

  const existing = await prisma.jail.findFirst({
    where: { guildId: target.guild.id, userId: target.id, active: true },
  });
  if (existing) return null;

  const jailRole = await target.guild.roles.fetch(settings.jailRoleId).catch(() => null);
  const jailChannel = await target.guild.channels.fetch(settings.jailChannelId).catch(() => null);
  if (!jailRole || !jailChannel || jailChannel.type !== ChannelType.GuildText) return null;
  ensureRoleManageableByBot(bot, jailRole);

  const previousRoleIds = target.roles.cache.filter((role) => role.id !== target.guild.id).map((role) => role.id);
  const { removable, failed } = filterRemovableJailRoles([...target.roles.cache.values()], bot, jailRole.id);

  const removedRoleIds: string[] = [];
  try {
    for (const role of removable) {
      await target.roles.remove(role, reason);
      removedRoleIds.push(role.id);
    }
    await target.roles.add(jailRole, reason);
  } catch {
    for (const roleId of removedRoleIds) {
      const role = await target.guild.roles.fetch(roleId).catch(() => null);
      if (role && canManageRole(bot, role)) await target.roles.add(role).catch(() => null);
    }
    throw new ModerationActionError('Security jail failed. Removed roles were restored where possible.');
  }

  await prisma.jail.create({
    data: {
      guildId: target.guild.id,
      userId: target.id,
      moderatorId: 'SYSTEM',
      reason,
      previousRoleIds: JSON.stringify(previousRoleIds),
      failedRemovedRoleIds: JSON.stringify(failed.map((role) => role.id)),
      jailRoleId: jailRole.id,
      jailChannelId: jailChannel.id,
    },
  });

  const caseId = await logModerationAction({
    guild: target.guild,
    action: 'SECURITY_AUTO_JAIL',
    targetUserId: target.id,
    reason,
    channelId: jailChannel.id,
    metadata: { failedRemovedRoleIds: failed.map((role) => role.id) },
  });

  return { caseId, failedRemovedRoleIds: failed.map((role) => role.id) };
}

export async function unjailUser(
  guild: Guild,
  target: GuildMember,
  releasedBy: string,
  reason = 'Unjail',
): Promise<{ caseId: number; failedRestoredRoleIds: string[] }> {
  const bot = await guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ManageRoles);
  const jail = await prisma.jail.findFirst({ where: { guildId: guild.id, userId: target.id, active: true } });
  if (!jail) throw new NotFoundError('This user is not currently jailed.');

  const previousRoleIds = JSON.parse(jail.previousRoleIds) as string[];
  const jailRole = await guild.roles.fetch(jail.jailRoleId).catch(() => null);
  if (jailRole && target.roles.cache.has(jailRole.id) && canManageRole(bot, jailRole)) {
    await target.roles.remove(jailRole, reason).catch(() => null);
  }

  const failedRestoredRoleIds: string[] = [];
  for (const roleId of previousRoleIds) {
    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (!role || target.roles.cache.has(roleId)) continue;
    if (!canManageRole(bot, role)) {
      failedRestoredRoleIds.push(roleId);
      continue;
    }
    await target.roles.add(role, reason).catch(() => failedRestoredRoleIds.push(roleId));
  }

  await prisma.jail.update({
    where: { id: jail.id },
    data: {
      active: false,
      releasedAt: new Date(),
      releasedBy,
      failedRestoredRoleIds: JSON.stringify([...new Set(failedRestoredRoleIds)]),
    },
  });

  const caseId = await logModerationAction({
    guild,
    action: 'UNJAIL',
    targetUserId: target.id,
    moderatorId: releasedBy === 'SYSTEM' ? undefined : releasedBy,
    reason,
    channelId: jail.jailChannelId,
    metadata: { failedRestoredRoleIds },
  });
  return { caseId, failedRestoredRoleIds };
}
