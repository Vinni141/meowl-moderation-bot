import { REST, Routes } from 'discord.js';
import { commands } from '../src/commands/index.js';
import { config } from '../src/lib/config.js';

const rest = new REST({ version: '10' }).setToken(config.DISCORD_BOT_TOKEN);
const body = commands.map((command) => command.data.toJSON());

await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID), {
  body,
});

console.log(`${body.length} Guild Slash Commands registriert.`);
