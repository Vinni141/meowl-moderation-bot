export const configurableCommands = [
  'warn',
  'warns',
  'cases',
  'listcommands',
  'mute',
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
  'purge',
  's',
  'slowmode',
  'lock',
  'unlock',
  'modlog',
  'nickname',
] as const;

export type ConfigurableCommand = (typeof configurableCommands)[number];

export function isConfigurableCommand(command: string): command is ConfigurableCommand {
  return configurableCommands.includes(command as ConfigurableCommand);
}

export function parseDisabledCommands(value: string | null | undefined): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
