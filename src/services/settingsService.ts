import { PermissionFlagsBits, type GuildMember, type TextChannel } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { logModerationAction } from './logService.js';
import { ensureBotHasPermission, ensureModeratorHasPermission } from './permissionService.js';

export async function setModLogChannel(moderator: GuildMember, channel: TextChannel): Promise<number> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ManageGuild);
  const bot = await moderator.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ViewChannel);
  ensureBotHasPermission(bot, PermissionFlagsBits.SendMessages);

  await prisma.guildSettings.upsert({
    where: { guildId: moderator.guild.id },
    update: { modLogChannelId: channel.id },
    create: { guildId: moderator.guild.id, modLogChannelId: channel.id },
  });

  return logModerationAction({
    guild: moderator.guild,
    action: 'MOD_LOG_CHANNEL_SET',
    moderatorId: moderator.id,
    channelId: channel.id,
  });
}
