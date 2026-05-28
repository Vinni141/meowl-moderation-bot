import { AuditLogEvent, type GuildBan } from 'discord.js';
import { enforceModerationSafety } from '../services/safetyService.js';
import { logModerationAction } from '../services/logService.js';

export async function handleGuildBanAdd(ban: GuildBan): Promise<void> {
  const auditLogs = await ban.guild
    .fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 })
    .catch(() => null);
  const entry = auditLogs?.entries.find(
    (item) =>
      item.target?.id === ban.user.id &&
      Date.now() - item.createdTimestamp < 15_000,
  );
  const executorId = entry?.executor?.id;

  if (!executorId || executorId === ban.client.user.id) return;

  await logModerationAction({
    guild: ban.guild,
    action: 'BAN',
    targetUserId: ban.user.id,
    moderatorId: executorId,
    reason: entry?.reason ?? 'External Discord ban',
    metadata: { source: 'guildBanAdd' },
  });
  await enforceModerationSafety(ban.guild, executorId, 'BAN');
}
