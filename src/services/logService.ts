import { ChannelType, type Guild, type GuildBasedChannel, type TextBasedChannel } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { config } from '../lib/config.js';
import { nextCaseId } from './caseService.js';
import { moderationEmbed } from './embedService.js';

export type LogModerationActionInput = {
  guild: Guild;
  action: string;
  targetUserId?: string;
  moderatorId?: string;
  reason?: string;
  duration?: string;
  channelId?: string;
  metadata?: Record<string, unknown>;
};

function formatUser(userId?: string): string {
  return userId ? `<@${userId}> (${userId})` : 'N/A';
}

function formatChannel(channelId?: string): string {
  return channelId ? `<#${channelId}> (${channelId})` : 'N/A';
}

function isLogChannel(channel: GuildBasedChannel | null): channel is TextBasedChannel & GuildBasedChannel {
  return Boolean(
    channel &&
      (channel.type === ChannelType.GuildText ||
        channel.type === ChannelType.GuildAnnouncement ||
        channel.type === ChannelType.PublicThread ||
        channel.type === ChannelType.PrivateThread),
  );
}

export async function logModerationAction(input: LogModerationActionInput): Promise<number> {
  const caseId = await nextCaseId(input.guild.id);
  const settings = await prisma.guildSettings.findUnique({ where: { guildId: input.guild.id } });

  await prisma.moderationLog.create({
    data: {
      guildId: input.guild.id,
      caseId,
      action: input.action,
      targetUserId: input.targetUserId,
      moderatorId: input.moderatorId,
      reason: input.reason,
      duration: input.duration,
      channelId: input.channelId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });

  const channelId = settings?.modLogChannelId || config.MOD_LOG_CHANNEL_ID || undefined;
  if (channelId) {
    const channel = await input.guild.channels.fetch(channelId).catch(() => null);
    if (isLogChannel(channel)) {
      await channel
        .send({
          embeds: [
            moderationEmbed([
              { name: 'Case', value: `#${caseId}`, inline: true },
              { name: 'Action', value: input.action, inline: true },
              { name: 'User', value: formatUser(input.targetUserId), inline: false },
              { name: 'Moderator', value: formatUser(input.moderatorId), inline: false },
              { name: 'Reason', value: input.reason ?? 'N/A', inline: false },
              { name: 'Duration', value: input.duration ?? 'N/A', inline: true },
              { name: 'Channel', value: formatChannel(input.channelId), inline: true },
              { name: 'Date', value: new Date().toISOString(), inline: false },
            ]),
          ],
        })
        .catch(() => null);
    }
  }

  return caseId;
}
