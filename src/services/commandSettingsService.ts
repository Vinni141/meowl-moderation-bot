import { prisma } from '../database/prisma.js';

export const configurableCommands = [
  'warn',
  'warns',
  'cases',
  'listcommands',
  'mute',
  'unmute',
  'kick',
  'ban',
  'unban',
  'jailsetup',
  'jail',
  'unjail',
  'afk',
  'roleadd',
  'roleremove',
  'temproleadd',
  'inrole',
  'purge',
  's',
  'slowmode',
  'lock',
  'unlock',
  'modlog',
  'nickname',
] as const;

export type ConfigurableCommand = (typeof configurableCommands)[number];

export function normalizeCommandName(commandName: string): string {
  return commandName.toLowerCase() === 'nick' ? 'nickname' : commandName.toLowerCase();
}

export async function getDisabledCommands(guildId: string): Promise<string[]> {
  const settings = await prisma.guildSettings.findUnique({ where: { guildId } });
  if (!settings?.disabledCommands) return [];

  try {
    const parsed = JSON.parse(settings.disabledCommands) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export async function isCommandEnabled(guildId: string, commandName: string): Promise<boolean> {
  const disabledCommands = await getDisabledCommands(guildId);
  return !disabledCommands.includes(normalizeCommandName(commandName));
}

export async function setCommandEnabled(
  guildId: string,
  commandName: string,
  enabled: boolean,
): Promise<string[]> {
  const normalized = normalizeCommandName(commandName);
  if (!configurableCommands.includes(normalized as ConfigurableCommand)) {
    throw new Error('Unknown command');
  }

  const disabledCommands = new Set(await getDisabledCommands(guildId));
  if (enabled) {
    disabledCommands.delete(normalized);
  } else {
    disabledCommands.add(normalized);
  }

  const next = [...disabledCommands].filter((item) =>
    configurableCommands.includes(item as ConfigurableCommand),
  );

  await prisma.guildSettings.upsert({
    where: { guildId },
    update: { disabledCommands: JSON.stringify(next) },
    create: { guildId, disabledCommands: JSON.stringify(next) },
  });

  return next;
}

export async function getCommandStates(guildId: string): Promise<Array<{ name: string; enabled: boolean }>> {
  const disabledCommands = await getDisabledCommands(guildId);
  return configurableCommands.map((name) => ({
    name,
    enabled: !disabledCommands.includes(name),
  }));
}
