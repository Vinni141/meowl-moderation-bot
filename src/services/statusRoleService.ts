import { ActivityType, PermissionFlagsBits, type Client, type GuildMember, type Presence, type User } from 'discord.js';
import { config } from '../lib/config.js';
import { ensureBotHasPermission } from './permissionService.js';

function configuredServerTagGuildId(): string {
  return config.SERVER_TAG_GUILD_ID.trim() || config.DISCORD_GUILD_ID;
}

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

function hasConfiguredServerTag(user: User): boolean {
  return user.primaryGuild?.identityEnabled === true && user.primaryGuild.identityGuildId === configuredServerTagGuildId();
}

async function setConditionalRole(member: GuildMember, roleId: string, shouldHaveRole: boolean, reason: string): Promise<void> {
  const cleanRoleId = roleId.trim();
  if (!cleanRoleId || member.user.bot) return;

  const bot = await member.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ManageRoles);

  const role = await member.guild.roles.fetch(cleanRoleId).catch(() => null);
  if (!role || role.managed || role.id === member.guild.id) return;

  const hasRole = member.roles.cache.has(role.id);
  if (shouldHaveRole && !hasRole) {
    await member.roles.add(role, reason).catch((error) => {
      console.error('Failed to add automatic role:', error);
    });
  } else if (!shouldHaveRole && hasRole) {
    await member.roles.remove(role, reason).catch((error) => {
      console.error('Failed to remove automatic role:', error);
    });
  }
}

export async function applyStatusRoleFromPresence(presence: Presence): Promise<void> {
  if (!presence.guild || !presence.member) return;

  const member = await presence.guild.members.fetch(presence.member.id).catch(() => null);
  if (!member) return;

  await Promise.all([
    setConditionalRole(
      member,
      config.STATUS_ROLE_ID,
      statusContainsPhrase(presence),
      `Status contains ${config.STATUS_ROLE_PHRASE}`,
    ),
    applyServerTagRoleToMember(member),
  ]);
}

export async function applyServerTagRoleToMember(member: GuildMember): Promise<void> {
  if (member.guild.id !== configuredServerTagGuildId()) return;

  await setConditionalRole(
    member,
    config.SERVER_TAG_ROLE_ID,
    hasConfiguredServerTag(member.user),
    'Server tag selection changed',
  );
}

export async function applyServerTagRoleFromUser(client: Client<true>, user: User): Promise<void> {
  const guild = client.guilds.cache.get(configuredServerTagGuildId());
  if (!guild) return;

  const member = await guild.members.fetch(user.id).catch(() => null);
  if (member) await applyServerTagRoleToMember(member);
}

export async function syncKnownStatusRoles(client: Client<true>): Promise<void> {
  const presenceUpdates = [...client.guilds.cache.values()].flatMap((guild) => [...guild.presences.cache.values()].map(applyStatusRoleFromPresence));
  const guild = client.guilds.cache.get(configuredServerTagGuildId());
  const members = guild ? await guild.members.fetch().catch(() => guild.members.cache) : [];
  const tagUpdates = [...members.values()].map(applyServerTagRoleToMember);

  await Promise.allSettled([...presenceUpdates, ...tagUpdates]);
}
