import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  type ButtonInteraction,
  type Guild,
  type GuildMember,
  type MessageActionRowComponentBuilder,
  type MessageCreateOptions,
} from 'discord.js';
import type { ModerationLog } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { UserInputError } from '../lib/errors.js';
import { ensureModeratorHasPermission } from './permissionService.js';
import { serverEmoji } from './emojiService.js';

const casesButtonPrefix = 'cases_page';
const pageSize = 10;

type CasesPageOptions = {
  embeds: NonNullable<MessageCreateOptions['embeds']>;
  components: NonNullable<MessageCreateOptions['components']>;
};

function formatDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function formatCaseReference(log: ModerationLog): string {
  return `#${log.caseId}`;
}

function durationLabel(log: ModerationLog): string {
  if (log.duration) return log.duration;
  if (log.action === 'WARN') return '30 days';
  return 'Permanent';
}

function actionIcon(guild: Guild, action: string): string {
  if (['BAN', 'KICK'].includes(action)) return serverEmoji(guild, 'cross');
  if (['UNBAN', 'UNMUTE', 'UNJAIL', 'UNWARN'].includes(action)) return serverEmoji(guild, 'check');
  return serverEmoji(guild, 'warn');
}

function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 1) return 0;
  return Math.min(Math.max(page, 0), totalPages - 1);
}

function createCasesComponents(targetUserId: string, page: number, totalPages: number) {
  const previousPage = Math.max(page - 1, 0);
  const nextPage = Math.min(page + 1, Math.max(totalPages - 1, 0));

  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${casesButtonPrefix}:${targetUserId}:${previousPage}`)
      .setLabel('Previous page')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`${casesButtonPrefix}:${targetUserId}:${nextPage}`)
      .setLabel('Next page')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages - 1),
  );

  return [row];
}

export async function buildCasesPage(
  moderator: GuildMember,
  target: GuildMember,
  requestedPage = 0,
): Promise<CasesPageOptions> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ModerateMembers);

  const where = {
    guildId: target.guild.id,
    targetUserId: target.id,
  };
  const totalCases = await prisma.moderationLog.count({ where });
  const totalPages = Math.max(Math.ceil(totalCases / pageSize), 1);
  const page = clampPage(requestedPage, totalPages);
  const logs = await prisma.moderationLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: page * pageSize,
    take: pageSize,
  });

  const lines = logs.length
    ? logs
        .map((log) => {
          const reason = log.reason?.trim() || 'No reason provided';
          return `[${formatDate(log.createdAt)}] ${actionIcon(target.guild, log.action)} ${formatCaseReference(log)} (${log.targetUserId ?? target.id}): ${reason} - ${durationLabel(log)}`;
        })
        .join('\n')
    : 'No moderation cases found.';

  const embed = new EmbedBuilder()
    .setColor(0x38bdf8)
    .setAuthor({
      name: `@${target.user.username}`,
      iconURL: target.user.displayAvatarURL(),
    })
    .setDescription(`**${totalCases} case(s) found**\n\n${lines}`)
    .setFooter({ text: `Page ${page + 1}/${totalPages}` });

  return {
    embeds: [embed],
    components: createCasesComponents(target.id, page, totalPages),
  };
}

export async function handleCasesPaginationButton(interaction: ButtonInteraction): Promise<boolean> {
  const [action, targetUserId, rawPage] = interaction.customId.split(':');
  if (action !== casesButtonPrefix || !targetUserId) return false;
  if (!interaction.guild) throw new UserInputError('This action can only be used in a server.');

  const moderator = await interaction.guild.members.fetch(interaction.user.id);
  const target = await interaction.guild.members.fetch(targetUserId).catch(() => null);
  if (!target) throw new UserInputError('That user is no longer in this server.');

  const page = Number(rawPage);
  const options = await buildCasesPage(moderator, target, Number.isInteger(page) ? page : 0);
  await interaction.update(options);
  return true;
}
