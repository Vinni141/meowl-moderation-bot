import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../services/embedService.js';
import { setModLogChannel } from '../../services/settingsService.js';
import type { SlashCommand } from '../../types/command.js';
import { requireGuildMember } from '../helpers.js';

export const modlogCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('modlog')
    .setDescription('Sets the moderation log channel.')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Moderation log channel')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText),
    ),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText]);
    const caseId = await setModLogChannel(requireGuildMember(interaction), channel);
    await interaction.reply({
      embeds: [successEmbed('Mod Log Channel Set', `Logs will be sent to ${channel}. Case #${caseId}`)],
      ephemeral: true,
    });
  },
};
