import {
  GuildMember,
  PermissionFlagsBits,
  type Guild,
  type PermissionsString,
  type Role,
} from 'discord.js';
import { BotPermissionError, PermissionError, UserInputError } from '../lib/errors.js';

export function ensureModeratorHasPermission(member: GuildMember, permission: bigint): void {
  if (!member.permissions.has(permission)) {
    throw new PermissionError('You do not have the required permission for this action.');
  }
}

export function ensureBotHasPermission(member: GuildMember, permission: bigint): void {
  if (!member.permissions.has(permission)) {
    throw new BotPermissionError('The bot is missing the required permission for this action.');
  }
}

export function isGuildOwner(guild: Guild, userId: string): boolean {
  return guild.ownerId === userId;
}

export function canManageMember(actor: GuildMember, target: GuildMember): boolean {
  if (actor.id === target.id) return false;
  if (target.guild.ownerId === target.id) return false;
  if (actor.guild.ownerId === actor.id) return true;
  return actor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

export function ensureTargetManageable(
  moderator: GuildMember,
  bot: GuildMember,
  target: GuildMember,
  botUserId: string,
): void {
  if (target.id === botUserId) throw new UserInputError('The bot cannot moderate itself.');
  if (target.id === moderator.id) throw new UserInputError('You cannot use this action on yourself.');
  if (isGuildOwner(target.guild, target.id)) throw new UserInputError('The server owner cannot be moderated.');
  if (!canManageMember(moderator, target)) {
    throw new PermissionError('The target user has an equal or higher role position.');
  }
  if (!canManageMember(bot, target)) {
    throw new BotPermissionError('The bot role is not above the target user.');
  }
}

export function isManagedRole(role: Role): boolean {
  return role.managed;
}

export function canManageRole(actor: GuildMember, role: Role): boolean {
  if (role.managed) return false;
  if (role.id === role.guild.id) return false;
  if (actor.guild.ownerId === actor.id) return true;
  return actor.roles.highest.comparePositionTo(role) > 0;
}

export function ensureRoleManageableByBot(bot: GuildMember, role: Role): void {
  if (!canManageRole(bot, role)) {
    throw new BotPermissionError('The bot cannot manage this role because of role hierarchy or managed role status.');
  }
}

export function ensureRoleManageableByModerator(moderator: GuildMember, role: Role): void {
  if (!canManageRole(moderator, role)) {
    throw new PermissionError('You cannot manage this role because of role hierarchy or managed role status.');
  }
}

export function permissionsList(flags: PermissionsString[]): bigint {
  return flags.reduce((value, flag) => value | PermissionFlagsBits[flag], 0n);
}
