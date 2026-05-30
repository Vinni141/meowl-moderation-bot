import { NextRequest, NextResponse } from 'next/server';
import { isConfigurableCommand, parseDisabledCommands } from '../../../../lib/commands';
import { prisma } from '../../../../lib/prisma';
import { requireGuildAccess } from '../../../../lib/auth';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const isJsonRequest = request.headers.get('content-type')?.includes('application/json') ?? false;
  const payload = isJsonRequest ? await request.json().catch(() => ({})) : null;
  const formData = isJsonRequest ? null : await request.formData();
  const command = String(isJsonRequest ? payload.command ?? '' : formData?.get('command') ?? '');
  const enabled = isJsonRequest ? payload.enabled === true : String(formData?.get('enabled') ?? '') === 'true';
  const guildId = String(isJsonRequest ? payload.guildId ?? '' : formData?.get('guildId') ?? '');

  if (!isConfigurableCommand(command)) {
    if (isJsonRequest) {
      return NextResponse.json({ ok: false, error: 'unknown-command' }, { status: 400 });
    }
    return NextResponse.redirect(new URL('/?error=unknown-command', request.url));
  }

  if (!guildId) {
    if (isJsonRequest) {
      return NextResponse.json({ ok: false, error: 'missing-guild' }, { status: 400 });
    }
    return NextResponse.redirect(new URL('/?error=missing-guild', request.url));
  }

  await requireGuildAccess(guildId);

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

  return NextResponse.redirect(new URL(`/?guildId=${guildId}`, request.url));
}
