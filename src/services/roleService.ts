import { PermissionFlagsBits, type GuildMember, type Role } from 'discord.js';
import { UserInputError } from '../lib/errors.js';
import { logModerationAction } from './logService.js';
import {
  ensureBotHasPermission,
  ensureModeratorHasPermission,
  ensureRoleManageableByBot,
  ensureRoleManageableByModerator,
} from './permissionService.js';

export async function addRole(moderator: GuildMember, target: GuildMember, role: Role, reason?: string): Promise<number> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ManageRoles);
  const bot = await target.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ManageRoles);
  ensureRoleManageableByModerator(moderator, role);
  ensureRoleManageableByBot(bot, role);
  if (target.roles.cache.has(role.id)) throw new UserInputError('The user already has this role.');
  await target.roles.add(role, reason);
  return logModerationAction({
    guild: target.guild,
    action: 'ROLE_ADD',
    targetUserId: target.id,
    moderatorId: moderator.id,
    reason,
    metadata: { roleId: role.id },
  });
}

export async function removeRole(moderator: GuildMember, target: GuildMember, role: Role, reason?: string): Promise<number> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ManageRoles);
  const bot = await target.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ManageRoles);
  ensureRoleManageableByModerator(moderator, role);
  ensureRoleManageableByBot(bot, role);
  if (!target.roles.cache.has(role.id)) throw new UserInputError('The user does not have this role.');
  await target.roles.remove(role, reason);
  return logModerationAction({
    guild: target.guild,
    action: 'ROLE_REMOVE',
    targetUserId: target.id,
    moderatorId: moderator.id,
    reason,
    metadata: { roleId: role.id },
  });
}
