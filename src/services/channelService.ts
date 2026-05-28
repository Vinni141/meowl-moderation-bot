import { PermissionFlagsBits, type GuildMember, type GuildTextBasedChannel } from 'discord.js';
import { UserInputError } from '../lib/errors.js';
import { logModerationAction } from './logService.js';
import { ensureBotHasPermission, ensureModeratorHasPermission } from './permissionService.js';

export async function setSlowmode(
  moderator: GuildMember,
  channel: GuildTextBasedChannel,
  seconds: number,
  reason?: string,
): Promise<number> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ManageChannels);
  const bot = await moderator.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ManageChannels);
  if (!('setRateLimitPerUser' in channel)) throw new UserInputError('This channel does not support slowmode.');
  if (seconds < 0 || seconds > 21_600) throw new UserInputError('seconds must be between 0 and 21600.');
  await channel.setRateLimitPerUser(seconds, reason);
  return logModerationAction({
    guild: moderator.guild,
    action: 'SLOWMODE',
    moderatorId: moderator.id,
    reason,
    channelId: channel.id,
    metadata: { seconds },
  });
}

export async function lockChannel(
  moderator: GuildMember,
  channel: GuildTextBasedChannel,
  reason?: string,
): Promise<number> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ManageChannels);
  const bot = await moderator.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ManageChannels);
  if (!('permissionOverwrites' in channel)) throw new UserInputError('This channel cannot be locked.');
  const everyone = moderator.guild.roles.everyone;
  const current = channel.permissionOverwrites.cache.get(everyone.id);
  if (current?.deny.has(PermissionFlagsBits.SendMessages)) {
    throw new UserInputError('This channel is already locked.');
  }
  await channel.permissionOverwrites.edit(
    everyone,
    {
      ViewChannel: true,
      SendMessages: false,
      AddReactions: false,
    },
    { reason },
  );
  return logModerationAction({
    guild: moderator.guild,
    action: 'LOCK',
    moderatorId: moderator.id,
    reason,
    channelId: channel.id,
  });
}

export async function unlockChannel(
  moderator: GuildMember,
  channel: GuildTextBasedChannel,
  reason?: string,
): Promise<number> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ManageChannels);
  const bot = await moderator.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ManageChannels);
  if (!('permissionOverwrites' in channel)) throw new UserInputError('This channel cannot be unlocked.');
  await channel.permissionOverwrites.edit(
    moderator.guild.roles.everyone,
    {
      ViewChannel: null,
      SendMessages: null,
      AddReactions: null,
    },
    { reason },
  );
  return logModerationAction({
    guild: moderator.guild,
    action: 'UNLOCK',
    moderatorId: moderator.id,
    reason,
    channelId: channel.id,
  });
}
