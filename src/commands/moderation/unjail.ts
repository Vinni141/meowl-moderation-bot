import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../services/embedService.js';
import { unjailUser } from '../../services/jailService.js';
import { ensureModeratorHasPermission } from '../../services/permissionService.js';
import type { SlashCommand } from '../../types/command.js';
import { getTargetMember, requireGuildMember } from '../helpers.js';

export const unjailCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('unjail')
    .setDescription('Removes jail and restores roles.')
    .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setMaxLength(512)),
  async execute(interaction) {
    const moderator = requireGuildMember(interaction);
    ensureModeratorHasPermission(moderator, PermissionFlagsBits.ManageRoles);
    const result = await unjailUser(
      moderator.guild,
      await getTargetMember(interaction),
      moderator.id,
      interaction.options.getString('reason') ?? 'Unjail',
    );
    const failed = result.failedRestoredRoleIds.length ? ` Could not restore: ${result.failedRestoredRoleIds.join(', ')}` : '';
    await interaction.reply({ embeds: [successEmbed('User Unjailed', `Case #${result.caseId}.${failed}`)], ephemeral: true });
  },
};
