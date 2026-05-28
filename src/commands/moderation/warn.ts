import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../services/embedService.js';
import { warnUser } from '../../services/moderationService.js';
import type { SlashCommand } from '../../types/command.js';
import { getTargetMember, requireGuildMember } from '../helpers.js';

export const warnCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warns a server member.')
    .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(512)),
  async execute(interaction) {
    const moderator = requireGuildMember(interaction);
    const target = await getTargetMember(interaction);
    const reason = interaction.options.getString('reason', true);
    const caseId = await warnUser(moderator, target, reason, interaction.channelId ?? undefined);
    await interaction.reply({ embeds: [successEmbed('Warning Created', `Case #${caseId}`)], ephemeral: true });
  },
};
