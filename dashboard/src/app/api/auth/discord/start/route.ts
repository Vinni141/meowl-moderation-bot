import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getRequiredEnv } from '../../../../../lib/env';

export async function GET(): Promise<NextResponse> {
  const state = crypto.randomBytes(24).toString('base64url');
  const cookieStore = await cookies();
  cookieStore.set('meowl_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });

  const params = new URLSearchParams({
    client_id: getRequiredEnv('DISCORD_CLIENT_ID'),
    redirect_uri: getRequiredEnv('DISCORD_REDIRECT_URI'),
    response_type: 'code',
    scope: 'identify guilds',
    state,
  });

  return NextResponse.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
}
