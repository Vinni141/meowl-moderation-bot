import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../services/embedService.js';
import { addRole } from '../../services/roleService.js';
import type { SlashCommand } from '../../types/command.js';
import { getTargetMember, requireGuildMember, requireRole } from '../helpers.js';

export const roleaddCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('roleadd')
    .setDescription('Adds a role to a user.')
    .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    .addRoleOption((option) => option.setName('role').setDescription('Role').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setMaxLength(512)),
  async execute(interaction) {
    const caseId = await addRole(
      requireGuildMember(interaction),
      await getTargetMember(interaction),
      requireRole(interaction),
      interaction.options.getString('reason') ?? undefined,
    );
    await interaction.reply({ embeds: [successEmbed('Role Added', `Case #${caseId}`)], ephemeral: true });
  },
};
