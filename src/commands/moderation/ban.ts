import { SlashCommandBuilder } from 'discord.js';
import { createBanConfirmation } from '../../services/banConfirmationService.js';
import type { SlashCommand } from '../../types/command.js';
import { getTargetMember, requireGuildMember } from '../helpers.js';

export const banCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bans a server member.')
    .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(512))
    .addIntegerOption((option) => option.setName('delete_messages_days').setDescription('0 to 7 days').setMinValue(0).setMaxValue(7)),
  async execute(interaction) {
    const moderator = requireGuildMember(interaction);
    const target = await getTargetMember(interaction);
    const reason = interaction.options.getString('reason', true);
    const deleteMessageDays = interaction.options.getInteger('delete_messages_days') ?? 0;
    await interaction.reply({
      ...createBanConfirmation(
        moderator,
        target,
        reason,
        deleteMessageDays,
        interaction.channelId ?? undefined,
      ),
      ephemeral: true,
    });
  },
};
