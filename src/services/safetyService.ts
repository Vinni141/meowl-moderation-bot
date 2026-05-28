import type { Guild, GuildMember } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { autoJailMember } from './jailService.js';
import { logModerationAction } from './logService.js';

type SafetyRule = {
  action: string;
  limit: number;
  windowMs: number;
};

const safetyRules: SafetyRule[] = [
  { action: 'BAN', limit: 10, windowMs: 5 * 60 * 1000 },
  { action: 'KICK', limit: 15, windowMs: 5 * 60 * 1000 },
  { action: 'MUTE', limit: 20, windowMs: 5 * 60 * 1000 },
  { action: 'PURGE', limit: 8, windowMs: 5 * 60 * 1000 },
];

export function getSafetyRule(action: string): SafetyRule | undefined {
  return safetyRules.find((rule) => rule.action === action);
}

export async function enforceModerationSafety(
  guild: Guild,
  moderatorId: string | undefined,
  action: string,
): Promise<void> {
  if (!moderatorId || moderatorId === 'SYSTEM') return;
  const rule = getSafetyRule(action);
  if (!rule) return;

  const since = new Date(Date.now() - rule.windowMs);
  const actionCount = await prisma.moderationLog.count({
    where: {
      guildId: guild.id,
      moderatorId,
      action,
      createdAt: { gte: since },
    },
  });

  if (actionCount <= rule.limit) return;

  const moderator = await guild.members.fetch(moderatorId).catch(() => null);
  if (!moderator) return;

  await autoJailForSafety(guild, moderator, action, actionCount, rule);
}

async function autoJailForSafety(
  guild: Guild,
  moderator: GuildMember,
  action: string,
  actionCount: number,
  rule: SafetyRule,
): Promise<void> {
  const reason = `Anti-abuse triggered: ${actionCount} ${action.toLowerCase()} actions in ${Math.round(
    rule.windowMs / 60_000,
  )} minutes.`;
  const result = await autoJailMember(moderator, reason).catch(async (error) => {
    await logModerationAction({
      guild,
      action: 'SECURITY_AUTO_JAIL_FAILED',
      targetUserId: moderator.id,
      reason,
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return null;
  });

  await logModerationAction({
    guild,
    action: result ? 'SECURITY_THRESHOLD_TRIGGERED' : 'SECURITY_THRESHOLD_TRIGGERED_AUTO_JAIL_SKIPPED',
    targetUserId: moderator.id,
    reason,
    metadata: {
      action,
      actionCount,
      limit: rule.limit,
      windowMs: rule.windowMs,
      autoJailCaseId: result?.caseId,
      note: result ? undefined : 'Auto-jail was not possible. Check jail setup, owner status, and role hierarchy.',
    },
  });
}
