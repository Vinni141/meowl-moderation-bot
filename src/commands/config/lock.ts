import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../services/embedService.js';
import { lockChannel } from '../../services/channelService.js';
import type { SlashCommand } from '../../types/command.js';
import { currentGuildTextChannel, requireGuildMember } from '../helpers.js';

export const lockCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Locks a channel.')
    .addChannelOption((option) => option.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setMaxLength(512)),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel', false, [ChannelType.GuildText]) ?? currentGuildTextChannel(interaction);
    const caseId = await lockChannel(requireGuildMember(interaction), channel, interaction.options.getString('reason') ?? undefined);
    await interaction.reply({ embeds: [successEmbed('Channel Locked', `Case #${caseId}`)], ephemeral: true });
  },
};
