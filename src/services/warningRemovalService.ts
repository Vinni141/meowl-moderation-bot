import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type MessageActionRowComponentBuilder,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { prisma } from '../database/prisma.js';
import { UserInputError } from '../lib/errors.js';
import { logModerationAction } from './logService.js';
import { ensureModeratorHasPermission } from './permissionService.js';

const removeWarnButtonPrefix = 'warn_remove';
const removeWarnSelectPrefix = 'warn_remove_select';

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

export function createRemoveWarningComponents(targetUserId: string, disabled = false) {
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${removeWarnButtonPrefix}:${targetUserId}`)
      .setLabel('Remove Warn')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );

  return [row];
}

export async function handleWarningRemovalButton(interaction: ButtonInteraction): Promise<boolean> {
  const [action, targetUserId] = interaction.customId.split(':');
  if (action !== removeWarnButtonPrefix || !targetUserId) return false;
  if (!interaction.guild) throw new UserInputError('This action can only be used in a server.');

  const moderator = await interaction.guild.members.fetch(interaction.user.id);
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ModerateMembers);

  const warnings = await prisma.warning.findMany({
    where: {
      guildId: interaction.guild.id,
      userId: targetUserId,
      active: true,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  if (!warnings.length) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x6b7280)
          .setTitle('No Warnings')
          .setDescription('This user has no active warnings to remove.'),
      ],
      ephemeral: true,
    });
    return true;
  }

  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${removeWarnSelectPrefix}:${targetUserId}`)
      .setPlaceholder('Select a warning to remove')
      .addOptions(
        warnings.map((warning, index) => ({
          label: `Warning ${index + 1}`,
          value: warning.id,
          description: truncate(warning.reason, 100),
        })),
      ),
  );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('Remove Warn')
        .setDescription(`Choose which warning to remove from <@${targetUserId}>.`),
    ],
    components: [row],
    ephemeral: true,
  });

  return true;
}

export async function handleWarningRemovalSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
  const [action, targetUserId] = interaction.customId.split(':');
  const warningId = interaction.values[0];
  if (action !== removeWarnSelectPrefix || !targetUserId || !warningId) return false;
  if (!interaction.guild) throw new UserInputError('This action can only be used in a server.');

  const moderator = await interaction.guild.members.fetch(interaction.user.id);
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ModerateMembers);

  const result = await prisma.warning.updateMany({
    where: {
      id: warningId,
      guildId: interaction.guild.id,
      userId: targetUserId,
      active: true,
    },
    data: { active: false },
  });

  if (!result.count) {
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(0x6b7280)
          .setTitle('Already Removed')
          .setDescription('That warning is no longer active.'),
      ],
      components: [],
    });
    return true;
  }

  const caseId = await logModerationAction({
    guild: interaction.guild,
    action: 'UNWARN',
    targetUserId,
    moderatorId: interaction.user.id,
    reason: 'Removed warning from warns menu',
    channelId: interaction.channelId ?? undefined,
    metadata: { warningId },
  });

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0x41d37e)
        .setTitle('Warning Removed')
        .setDescription(`Removed a warning from <@${targetUserId}>. Case #${caseId}`),
    ],
    components: [],
  });

  return true;
}
