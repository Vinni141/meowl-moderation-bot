import { NextRequest, NextResponse } from 'next/server';
import { isConfigurableCommand, parseDisabledCommands } from '../../../../lib/commands';
import { prisma } from '../../../../lib/prisma';
import { requireSession } from '../../../../lib/auth';
import { getRequiredEnv } from '../../../../lib/env';

export async function POST(request: NextRequest): Promise<NextResponse> {
  await requireSession();

  const formData = await request.formData();
  const command = String(formData.get('command') ?? '');
  const enabled = String(formData.get('enabled') ?? '') === 'true';

  if (!isConfigurableCommand(command)) {
    return NextResponse.redirect(new URL('/?error=unknown-command', request.url));
  }

  const guildId = getRequiredEnv('DISCORD_GUILD_ID');
  const settings = await prisma.guildSettings.findUnique({ where: { guildId } });
  const disabled = new Set(parseDisabledCommands(settings?.disabledCommands));

  if (enabled) {
    disabled.delete(command);
  } else {
    disabled.add(command);
  }

  await prisma.guildSettings.upsert({
    where: { guildId },
    update: { disabledCommands: JSON.stringify([...disabled]) },
    create: { guildId, disabledCommands: JSON.stringify([...disabled]) },
  });

  return NextResponse.redirect(new URL('/', request.url));
}
