import { SlashCommandBuilder } from 'discord.js';
import { deleteMessageLater } from '../../lib/deleteMessageLater.js';
import { compactStatusEmbed } from '../../services/embedService.js';
import { setAfk } from '../../services/afkService.js';
import type { SlashCommand } from '../../types/command.js';
import { requireGuildMember } from '../helpers.js';

export const afkCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Sets your AFK status.')
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setMaxLength(256)),
  async execute(interaction) {
    const member = requireGuildMember(interaction);
    const reason = interaction.options.getString('reason') ?? 'AFK';
    await setAfk(member, reason);
    await interaction.reply({
      embeds: [compactStatusEmbed(`✅ ${member}: You're now AFK with the status: **${reason}**`)],
    });
    const reply = await interaction.fetchReply();
    deleteMessageLater(reply);
  },
};
