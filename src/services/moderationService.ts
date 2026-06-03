import { PermissionFlagsBits, type Guild, type GuildMember, type Message, type TextBasedChannel } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { UserInputError } from '../lib/errors.js';
import { DISCORD_TIMEOUT_MAX_MS, parseDuration } from './durationService.js';
import { dmModerationEmbed } from './embedService.js';
import { logModerationAction } from './logService.js';
import { enforceModerationSafety } from './safetyService.js';
import { recordDeletedMessage } from './snipeService.js';
import {
  ensureBotHasPermission,
  ensureModeratorHasPermission,
  ensureTargetManageable,
} from './permissionService.js';

export const WARNING_EXPIRES_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export function getWarningExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + WARNING_EXPIRES_AFTER_MS);
}

export async function warnUser(
  moderator: GuildMember,
  target: GuildMember,
  reason: string,
  channelId?: string,
): Promise<number> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ModerateMembers);
  const bot = await target.guild.members.fetchMe();
  ensureTargetManageable(moderator, bot, target, bot.id);

  await prisma.warning.create({
    data: {
      guildId: target.guild.id,
      userId: target.id,
      moderatorId: moderator.id,
      reason,
      expiresAt: getWarningExpiresAt(),
    },
  });
  await target
    .send({ embeds: [dmModerationEmbed('You got warned', reason, target.guild, '30 days')] })
    .catch(() => null);
  return logModerationAction({
    guild: target.guild,
    action: 'WARN',
    targetUserId: target.id,
    moderatorId: moderator.id,
    reason,
    channelId,
  });
}

export async function muteUser(
  moderator: GuildMember,
  target: GuildMember,
  durationInput: string,
  reason: string,
  channelId?: string,
): Promise<number> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ModerateMembers);
  const bot = await target.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ModerateMembers);
  ensureTargetManageable(moderator, bot, target, bot.id);
  const duration = parseDuration(durationInput, DISCORD_TIMEOUT_MAX_MS);

  await target.timeout(duration.milliseconds, reason);
  await prisma.mute.create({
    data: {
      guildId: target.guild.id,
      userId: target.id,
      moderatorId: moderator.id,
      reason,
      expiresAt: duration.expiresAt,
    },
  });
  await target
    .send({ embeds: [dmModerationEmbed('You got muted', reason, target.guild, duration.input)] })
    .catch(() => null);
  const caseId = await logModerationAction({
    guild: target.guild,
    action: 'MUTE',
    targetUserId: target.id,
    moderatorId: moderator.id,
    reason,
    duration: duration.input,
    channelId,
  });
  await enforceModerationSafety(target.guild, moderator.id, 'MUTE');
  return caseId;
}

export async function unmuteUser(
  moderator: GuildMember,
  target: GuildMember,
  reason: string,
  channelId?: string,
): Promise<number> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ModerateMembers);
  const bot = await target.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ModerateMembers);
  ensureTargetManageable(moderator, bot, target, bot.id);

  const activeMute = await prisma.mute.findFirst({
    where: {
      guildId: target.guild.id,
      userId: target.id,
      active: true,
    },
  });
  if (!target.communicationDisabledUntilTimestamp && !activeMute) {
    throw new UserInputError('That user is not muted.');
  }

  await target.timeout(null, reason);
  await prisma.mute.updateMany({
    where: {
      guildId: target.guild.id,
      userId: target.id,
      active: true,
    },
    data: { active: false },
  });
  await target
    .send({ embeds: [dmModerationEmbed('You got unmuted', reason, target.guild)] })
    .catch(() => null);

  return logModerationAction({
    guild: target.guild,
    action: 'UNMUTE',
    targetUserId: target.id,
    moderatorId: moderator.id,
    reason,
    channelId,
  });
}

export async function kickUser(
  moderator: GuildMember,
  target: GuildMember,
  reason: string,
  channelId?: string,
): Promise<number> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.KickMembers);
  const bot = await target.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.KickMembers);
  ensureTargetManageable(moderator, bot, target, bot.id);
  await target.kick(reason);
  const caseId = await logModerationAction({
    guild: target.guild,
    action: 'KICK',
    targetUserId: target.id,
    moderatorId: moderator.id,
    reason,
    channelId,
  });
  await enforceModerationSafety(target.guild, moderator.id, 'KICK');
  return caseId;
}

export async function banUser(
  moderator: GuildMember,
  target: GuildMember,
  reason: string,
  deleteMessageDays = 0,
  channelId?: string,
): Promise<number> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.BanMembers);
  const bot = await target.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.BanMembers);
  ensureTargetManageable(moderator, bot, target, bot.id);
  if (deleteMessageDays < 0 || deleteMessageDays > 7) {
    throw new UserInputError('delete_messages_days must be between 0 and 7.');
  }

  await target.send({ embeds: [dmModerationEmbed('You got banned', reason, target.guild)] }).catch(() => null);
  await target.ban({ reason, deleteMessageSeconds: deleteMessageDays * 86_400 });
  const caseId = await logModerationAction({
    guild: target.guild,
    action: 'BAN',
    targetUserId: target.id,
    moderatorId: moderator.id,
    reason,
    channelId,
    metadata: { deleteMessageDays },
  });
  await enforceModerationSafety(target.guild, moderator.id, 'BAN');
  return caseId;
}

export async function unbanUser(
  guild: Guild,
  moderator: GuildMember,
  userId: string,
  reason: string,
  channelId?: string,
): Promise<number> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.BanMembers);
  const bot = await guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.BanMembers);

  const ban = await guild.bans.fetch(userId).catch(() => null);
  if (!ban) throw new UserInputError('That user is not banned.');

  await guild.bans.remove(userId, reason);
  return logModerationAction({
    guild,
    action: 'UNBAN',
    targetUserId: userId,
    moderatorId: moderator.id,
    reason,
    channelId,
  });
}

export async function purgeMessages(
  moderator: GuildMember,
  channel: TextBasedChannel,
  amount: number,
  reason?: string,
  userId?: string,
  beforeMessageId?: string,
): Promise<{ deleted: number; skippedOld: number; caseId: number }> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ManageMessages);
  const bot = await moderator.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ManageMessages);
  if (!('bulkDelete' in channel) || !('messages' in channel)) {
    throw new UserInputError('This command can only be used in text channels.');
  }
  if (amount < 1 || amount > 100) throw new UserInputError('amount must be between 1 and 100.');

  const messages: Message[] = [];
  let before = beforeMessageId;
  let scanned = 0;

  while (messages.length < amount && scanned < (userId ? 500 : amount)) {
    const limit = userId ? 100 : amount;
    const fetched = await channel.messages.fetch({ limit, before });
    if (!fetched.size) break;

    before = fetched.last()?.id;
    scanned += fetched.size;

    for (const message of fetched.values()) {
      if (message.id === beforeMessageId) continue;
      if (!beforeMessageId && message.author.id === moderator.id && message.content.toLowerCase().startsWith(',purge')) {
        continue;
      }
      if (userId && message.author.id !== userId) continue;
      messages.push(message);
      if (messages.length >= amount) break;
    }

    if (!userId) break;
  }

  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recentMessages = messages.filter((message) => message.createdTimestamp > twoWeeksAgo);
  const olderMessages = messages.filter((message) => message.createdTimestamp <= twoWeeksAgo);

  for (const message of recentMessages) {
    recordDeletedMessage(message);
  }

  let deletedCount = 0;
  if (recentMessages.length) {
    const deleted = await channel.bulkDelete(recentMessages, true);
    deletedCount += deleted.size;
  }

  const skippedOld = olderMessages.length;

  const [caseId] = await Promise.all([
    logModerationAction({
      guild: moderator.guild,
      action: 'PURGE',
      moderatorId: moderator.id,
      reason,
      channelId: channel.id,
      metadata: { requested: amount, deleted: deletedCount, skippedOld, userId },
    }),
    enforceModerationSafety(moderator.guild, moderator.id, 'PURGE'),
  ]);

  return { deleted: deletedCount, skippedOld, caseId };
}
