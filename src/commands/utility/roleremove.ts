import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../services/embedService.js';
import { removeRole } from '../../services/roleService.js';
import type { SlashCommand } from '../../types/command.js';
import { getTargetMember, requireGuildMember, requireRole } from '../helpers.js';

export const roleremoveCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('roleremove')
    .setDescription('Removes a role from a user.')
    .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    .addRoleOption((option) => option.setName('role').setDescription('Role').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setMaxLength(512)),
  async execute(interaction) {
    const caseId = await removeRole(
      requireGuildMember(interaction),
      await getTargetMember(interaction),
      requireRole(interaction),
      interaction.options.getString('reason') ?? undefined,
    );
    await interaction.reply({ embeds: [successEmbed('Role Removed', `Case #${caseId}`)], ephemeral: true });
  },
};
