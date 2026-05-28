import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../services/embedService.js';
import { jailUser } from '../../services/jailService.js';
import type { SlashCommand } from '../../types/command.js';
import { getTargetMember, requireGuildMember } from '../helpers.js';

export const jailCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('jail')
    .setDescription('Isolates a compromised or scam-suspected account.')
    .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(512))
    .addStringOption((option) => option.setName('duration').setDescription('Optional: 10s, 5m, 2h, 7d')),
  async execute(interaction) {
    const result = await jailUser(
      requireGuildMember(interaction),
      await getTargetMember(interaction),
      interaction.options.getString('reason', true),
      interaction.options.getString('duration') ?? undefined,
    );
    const failed = result.failedRemovedRoleIds.length ? ` Roles that could not be removed: ${result.failedRemovedRoleIds.join(', ')}` : '';
    await interaction.reply({ embeds: [successEmbed('User Jailed', `Case #${result.caseId}.${failed}`)], ephemeral: true });
  },
};
