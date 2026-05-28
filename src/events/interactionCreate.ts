import type { Interaction } from 'discord.js';
import { commandMap } from '../commands/index.js';
import { errorToEmbed, UserInputError } from '../lib/errors.js';
import { isCommandEnabled } from '../services/commandSettingsService.js';

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const command = commandMap.get(interaction.commandName);
  if (!command) return;

  try {
    if (interaction.guildId && !(await isCommandEnabled(interaction.guildId, interaction.commandName))) {
      throw new UserInputError('This command is currently disabled.');
    }
    await command.execute(interaction);
  } catch (error) {
    const payload = { embeds: [errorToEmbed(error)], ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
  }
}
