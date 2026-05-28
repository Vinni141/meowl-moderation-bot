import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../services/embedService.js';
import { muteUser } from '../../services/moderationService.js';
import type { SlashCommand } from '../../types/command.js';
import { getTargetMember, requireGuildMember } from '../helpers.js';

export const muteCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Applies a Discord timeout.')
    .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    .addStringOption((option) => option.setName('duration').setDescription('Example: 10s, 5m, 2h, 7d').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(512)),
  async execute(interaction) {
    const caseId = await muteUser(
      requireGuildMember(interaction),
      await getTargetMember(interaction),
      interaction.options.getString('duration', true),
      interaction.options.getString('reason', true),
      interaction.channelId ?? undefined,
    );
    await interaction.reply({ embeds: [successEmbed('Mute Applied', `Case #${caseId}`)], ephemeral: true });
  },
};
