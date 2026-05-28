import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../services/embedService.js';
import { unlockChannel } from '../../services/channelService.js';
import type { SlashCommand } from '../../types/command.js';
import { currentGuildTextChannel, requireGuildMember } from '../helpers.js';

export const unlockCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlocks a channel.')
    .addChannelOption((option) => option.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setMaxLength(512)),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel', false, [ChannelType.GuildText]) ?? currentGuildTextChannel(interaction);
    const caseId = await unlockChannel(requireGuildMember(interaction), channel, interaction.options.getString('reason') ?? undefined);
    await interaction.reply({ embeds: [successEmbed('Channel Unlocked', `Case #${caseId}`)], ephemeral: true });
  },
};
