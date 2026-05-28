import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './lib/config.js';
import { prisma } from './database/prisma.js';
import { stopDashboard } from './services/dashboardService.js';
import { handleInteractionCreate } from './events/interactionCreate.js';
import { handleMessageCreate } from './events/messageCreate.js';
import { handleReady } from './events/ready.js';
import { handleGuildBanAdd } from './events/guildBanAdd.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once('ready', (readyClient) => void handleReady(readyClient));
client.on('interactionCreate', (interaction) => void handleInteractionCreate(interaction));
client.on('messageCreate', (message) => void handleMessageCreate(message));
client.on('guildBanAdd', (ban) => void handleGuildBanAdd(ban));
client.on('error', (error) => console.error('Discord client error', error));
client.on('shardError', (error) => console.error('Discord shard error', error));

process.on('unhandledRejection', (reason) => console.error('Unhandled rejection', reason));
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

async function shutdown(): Promise<void> {
  client.destroy();
  await stopDashboard();
  await prisma.$disconnect();
  process.exit(0);
}

await client.login(config.DISCORD_BOT_TOKEN);
