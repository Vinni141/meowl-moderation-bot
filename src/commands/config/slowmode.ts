import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../services/embedService.js';
import { setSlowmode } from '../../services/channelService.js';
import type { SlashCommand } from '../../types/command.js';
import { currentGuildTextChannel, requireGuildMember } from '../helpers.js';

export const slowmodeCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Sets slowmode in the current channel.')
    .addIntegerOption((option) => option.setName('seconds').setDescription('0 to 21600').setRequired(true).setMinValue(0).setMaxValue(21600))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setMaxLength(512)),
  async execute(interaction) {
    const caseId = await setSlowmode(
      requireGuildMember(interaction),
      currentGuildTextChannel(interaction),
      interaction.options.getInteger('seconds', true),
      interaction.options.getString('reason') ?? undefined,
    );
    await interaction.reply({ embeds: [successEmbed('Slowmode Updated', `Case #${caseId}`)], ephemeral: true });
  },
};
