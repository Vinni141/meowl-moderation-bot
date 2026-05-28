import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import { UserInputError } from '../lib/errors.js';
import { logModerationAction } from './logService.js';
import {
  ensureBotHasPermission,
  ensureModeratorHasPermission,
  ensureTargetManageable,
} from './permissionService.js';

export async function setNickname(
  moderator: GuildMember,
  target: GuildMember,
  nickname: string | null,
  reason?: string,
): Promise<number> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ManageNicknames);
  const bot = await target.guild.members.fetchMe();
  ensureBotHasPermission(bot, PermissionFlagsBits.ManageNicknames);
  ensureTargetManageable(moderator, bot, target, bot.id);

  if (nickname !== null && (nickname.length < 1 || nickname.length > 32)) {
    throw new UserInputError('Nicknames must be between 1 and 32 characters.');
  }

  await target.setNickname(nickname, reason ?? 'Nickname updated');
  return logModerationAction({
    guild: target.guild,
    action: 'NICKNAME_UPDATE',
    targetUserId: target.id,
    moderatorId: moderator.id,
    reason,
    metadata: { nickname },
  });
}
