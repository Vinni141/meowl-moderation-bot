import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../services/embedService.js';
import { banUser } from '../../services/moderationService.js';
import type { SlashCommand } from '../../types/command.js';
import { getTargetMember, requireGuildMember } from '../helpers.js';

export const banCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bans a server member.')
    .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(512))
    .addIntegerOption((option) => option.setName('delete_messages_days').setDescription('0 to 7 days').setMinValue(0).setMaxValue(7)),
  async execute(interaction) {
    const caseId = await banUser(
      requireGuildMember(interaction),
      await getTargetMember(interaction),
      interaction.options.getString('reason', true),
      interaction.options.getInteger('delete_messages_days') ?? 0,
      interaction.channelId ?? undefined,
    );
    await interaction.reply({ embeds: [successEmbed('User Banned', `Case #${caseId}`)], ephemeral: true });
  },
};
