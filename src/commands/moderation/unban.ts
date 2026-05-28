import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../services/embedService.js';
import { unbanUser } from '../../services/moderationService.js';
import type { SlashCommand } from '../../types/command.js';
import { requireGuildMember } from '../helpers.js';

export const unbanCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unbans a user by ID.')
    .addStringOption((option) =>
      option.setName('user_id').setDescription('Discord user ID').setRequired(true).setMinLength(17).setMaxLength(20),
    )
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setMaxLength(512)),
  async execute(interaction) {
    const caseId = await unbanUser(
      interaction.guild!,
      requireGuildMember(interaction),
      interaction.options.getString('user_id', true),
      interaction.options.getString('reason') ?? 'No reason provided',
      interaction.channelId ?? undefined,
    );
    await interaction.reply({ embeds: [successEmbed('User Unbanned', `Case #${caseId}`)], ephemeral: true });
  },
};
