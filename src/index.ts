import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './lib/config.js';
import { prisma } from './database/prisma.js';
import { stopDashboard } from './services/dashboardService.js';
import { handleInteractionCreate } from './events/interactionCreate.js';
import { handleMessageCreate } from './events/messageCreate.js';
import { handleMessageDelete } from './events/messageDelete.js';
import { handleReady } from './events/ready.js';
import { handleGuildBanAdd } from './events/guildBanAdd.js';
import { handlePresenceUpdate } from './events/presenceUpdate.js';
import { handleUserUpdate } from './events/userUpdate.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once('ready', (readyClient) => void handleReady(readyClient));
client.on('interactionCreate', (interaction) => void handleInteractionCreate(interaction));
client.on('messageCreate', (message) => void handleMessageCreate(message));
client.on('messageDelete', (message) => void handleMessageDelete(message));
client.on('guildBanAdd', (ban) => void handleGuildBanAdd(ban));
client.on('presenceUpdate', (oldPresence, newPresence) => void handlePresenceUpdate(oldPresence, newPresence));
client.on('userUpdate', (oldUser, newUser) => void handleUserUpdate(client, oldUser, newUser));
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
