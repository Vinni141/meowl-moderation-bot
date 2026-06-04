import { ActivityType, PermissionFlagsBits, type Client, type Presence } from 'discord.js';
import { config } from '../lib/config.js';
import { ensureBotHasPermission } from './permissionService.js';

function statusContainsPhrase(presence: Presence): boolean {
  const phrase = config.STATUS_ROLE_PHRASE.trim().toLowerCase();
  if (!phrase) return false;

  return presence.activities.some((activity) => {
    const values = [
      activity.name,
      activity.state,
      activity.details,
      activity.type === ActivityType.Custom ? activity.state : undefined,
    ];
    return values.some((value) => value?.toLowerCase().includes(phrase));
  });
}

export async function applyStatusRoleFromPresence(presence: Presence): Promise<void> {
  const roleId = config.STATUS_ROLE_ID.trim();
  if (!roleId || !presence.guild || !presence.member) return;

  const member = await presence.guild.members.fetch(presence.member.id).catch(() => null);
  if (!member || member.user.bot) return;

  const bot = await presence.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ManageRoles);

  const role = await presence.guild.roles.fetch(roleId).catch(() => null);
  if (!role || role.managed || role.id === presence.guild.id) return;

  const shouldHaveRole = statusContainsPhrase(presence);
  const hasRole = member.roles.cache.has(role.id);

  if (shouldHaveRole && !hasRole) {
    await member.roles.add(role, `Status contains ${config.STATUS_ROLE_PHRASE}`).catch((error) => {
      console.error('Failed to add status role:', error);
    });
  } else if (!shouldHaveRole && hasRole) {
    await member.roles.remove(role, `Status no longer contains ${config.STATUS_ROLE_PHRASE}`).catch((error) => {
      console.error('Failed to remove status role:', error);
    });
  }
}

export async function syncKnownStatusRoles(client: Client<true>): Promise<void> {
  await Promise.allSettled([...client.guilds.cache.values()].flatMap((guild) => [...guild.presences.cache.values()].map(applyStatusRoleFromPresence)));
}
