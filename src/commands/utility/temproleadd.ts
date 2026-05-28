import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../services/embedService.js';
import { addTempRole } from '../../services/tempRoleService.js';
import type { SlashCommand } from '../../types/command.js';
import { getTargetMember, requireGuildMember, requireRole } from '../helpers.js';

export const temproleaddCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('temproleadd')
    .setDescription('Adds a temporary role to a user.')
    .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    .addRoleOption((option) => option.setName('role').setDescription('Role').setRequired(true))
    .addStringOption((option) => option.setName('duration').setDescription('10s, 5m, 2h, 7d').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setMaxLength(512)),
  async execute(interaction) {
    const caseId = await addTempRole(
      requireGuildMember(interaction),
      await getTargetMember(interaction),
      requireRole(interaction),
      interaction.options.getString('duration', true),
      interaction.options.getString('reason') ?? undefined,
    );
    await interaction.reply({ embeds: [successEmbed('Temporary Role Added', `Case #${caseId}`)], ephemeral: true });
  },
};
