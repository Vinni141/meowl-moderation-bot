import { NextRequest, NextResponse } from 'next/server';
import { isConfigurableCommand, parseDisabledCommands } from '../../../../lib/commands';
import { prisma } from '../../../../lib/prisma';
import { requireSession } from '../../../../lib/auth';
import { getRequiredEnv } from '../../../../lib/env';

export async function POST(request: NextRequest): Promise<NextResponse> {
  await requireSession();

  const isJsonRequest = request.headers.get('content-type')?.includes('application/json') ?? false;
  const payload = isJsonRequest ? await request.json().catch(() => ({})) : null;
  const formData = isJsonRequest ? null : await request.formData();
  const command = String(isJsonRequest ? payload.command ?? '' : formData?.get('command') ?? '');
  const enabled = isJsonRequest ? payload.enabled === true : String(formData?.get('enabled') ?? '') === 'true';

  if (!isConfigurableCommand(command)) {
    if (isJsonRequest) {
      return NextResponse.json({ ok: false, error: 'unknown-command' }, { status: 400 });
    }
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

  if (isJsonRequest) {
    return NextResponse.json({ ok: true, command, enabled });
  }

  return NextResponse.redirect(new URL('/', request.url));
}
