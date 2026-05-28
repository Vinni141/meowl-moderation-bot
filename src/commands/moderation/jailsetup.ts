import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../services/embedService.js';
import { setupJail } from '../../services/jailService.js';
import type { SlashCommand } from '../../types/command.js';
import { requireGuildMember, requireRole } from '../helpers.js';

export const jailsetupCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('jailsetup')
    .setDescription('Configures the jail role and jail channel.')
    .addRoleOption((option) => option.setName('role').setDescription('Jail role').setRequired(true))
    .addChannelOption((option) =>
      option.setName('channel').setDescription('Jail channel').setRequired(true).addChannelTypes(ChannelType.GuildText),
    ),
  async execute(interaction) {
    const result = await setupJail(
      requireGuildMember(interaction),
      requireRole(interaction),
      interaction.options.getChannel('channel', true, [ChannelType.GuildText]),
    );
    const failed = result.failedChannels.length ? ` Failed: ${result.failedChannels.map((id) => `<#${id}>`).join(', ')}` : '';
    await interaction.reply({
      embeds: [successEmbed('Jail Configured', `${result.updatedChannels} channels updated. Case #${result.caseId}.${failed}`)],
      ephemeral: true,
    });
  },
};
