import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../services/embedService.js';
import { kickUser } from '../../services/moderationService.js';
import type { SlashCommand } from '../../types/command.js';
import { getTargetMember, requireGuildMember } from '../helpers.js';

export const kickCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kicks a server member.')
    .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(512)),
  async execute(interaction) {
    const caseId = await kickUser(
      requireGuildMember(interaction),
      await getTargetMember(interaction),
      interaction.options.getString('reason', true),
      interaction.channelId ?? undefined,
    );
    await interaction.reply({ embeds: [successEmbed('User Kicked', `Case #${caseId}`)], ephemeral: true });
  },
};
