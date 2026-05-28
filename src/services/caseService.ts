import { prisma } from '../database/prisma.js';

export async function nextCaseId(guildId: string): Promise<number> {
  const last = await prisma.moderationLog.findFirst({
    where: { guildId },
    orderBy: { caseId: 'desc' },
    select: { caseId: true },
  });

  return (last?.caseId ?? 0) + 1;
}

export function nextCaseIdFromExisting(existingCaseIds: number[]): number {
  return existingCaseIds.length === 0 ? 1 : Math.max(...existingCaseIds) + 1;
}
