import { PermissionFlagsBits, type Guild, type GuildMember, type Role } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { parseDuration } from './durationService.js';
import { logModerationAction } from './logService.js';
import {
  ensureBotHasPermission,
  ensureModeratorHasPermission,
  ensureRoleManageableByBot,
  ensureRoleManageableByModerator,
} from './permissionService.js';
import { addRole } from './roleService.js';

export async function addTempRole(
  moderator: GuildMember,
  target: GuildMember,
  role: Role,
  durationInput: string,
  reason?: string,
): Promise<number> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ManageRoles);
  const bot = await target.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ManageRoles);
  ensureRoleManageableByModerator(moderator, role);
  ensureRoleManageableByBot(bot, role);
  const duration = parseDuration(durationInput);

  if (!target.roles.cache.has(role.id)) {
    await addRole(moderator, target, role, reason);
  }

  await prisma.tempRole.create({
    data: {
      guildId: target.guild.id,
      userId: target.id,
      roleId: role.id,
      moderatorId: moderator.id,
      reason,
      expiresAt: duration.expiresAt,
    },
  });

  return logModerationAction({
    guild: target.guild,
    action: 'TEMP_ROLE_ADD',
    targetUserId: target.id,
    moderatorId: moderator.id,
    reason,
    duration: duration.input,
    metadata: { roleId: role.id },
  });
}

export async function expireTempRole(guild: Guild, tempRoleId: string): Promise<void> {
  const tempRole = await prisma.tempRole.findUnique({ where: { id: tempRoleId } });
  if (!tempRole || !tempRole.active) return;
  const member = await guild.members.fetch(tempRole.userId).catch(() => null);
  const role = await guild.roles.fetch(tempRole.roleId).catch(() => null);
  const bot = await guild.members.fetchMe();

  if (member && role && member.roles.cache.has(role.id) && bot.roles.highest.comparePositionTo(role) > 0) {
    await member.roles.remove(role, 'Temporary role expired').catch(() => null);
  }

  await prisma.tempRole.update({
    where: { id: tempRole.id },
    data: { active: false, removedAt: new Date() },
  });

  await logModerationAction({
    guild,
    action: 'TEMP_ROLE_EXPIRED',
    targetUserId: tempRole.userId,
    moderatorId: undefined,
    reason: 'Temporary role expired',
    metadata: { roleId: tempRole.roleId },
  });
}

export function isExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
