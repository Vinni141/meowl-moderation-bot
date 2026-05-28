import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../services/embedService.js';
import { purgeMessages } from '../../services/moderationService.js';
import type { SlashCommand } from '../../types/command.js';
import { currentGuildTextChannel, requireGuildMember } from '../helpers.js';

export const purgeCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Deletes messages in the current channel.')
    .addIntegerOption((option) => option.setName('amount').setDescription('1 to 100').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption((option) => option.setName('user').setDescription('Only delete messages from this user'))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setMaxLength(512)),
  async execute(interaction) {
    const result = await purgeMessages(
      requireGuildMember(interaction),
      currentGuildTextChannel(interaction),
      interaction.options.getInteger('amount', true),
      interaction.options.getString('reason') ?? undefined,
      interaction.options.getUser('user')?.id,
    );
    await interaction.reply({ embeds: [successEmbed('Messages Deleted', `${result.deleted} messages deleted. Case #${result.caseId}`)], ephemeral: true });
  },
};
