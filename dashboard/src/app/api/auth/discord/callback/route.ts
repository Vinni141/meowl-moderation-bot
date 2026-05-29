import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, setSessionCookie } from '../../../../../lib/auth';
import { getAdminUserIds, getRequiredEnv } from '../../../../../lib/env';

type DiscordUser = {
  id: string;
  username: string;
  avatar: string | null;
};

async function exchangeCode(code: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: getRequiredEnv('DISCORD_CLIENT_ID'),
    client_secret: getRequiredEnv('DISCORD_CLIENT_SECRET'),
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRequiredEnv('DISCORD_REDIRECT_URI'),
  });

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error('Discord token exchange failed.');
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('Discord did not return an access token.');
  }

  return data.access_token;
}

async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Discord user lookup failed.');
  }

  return (await response.json()) as DiscordUser;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieStore = await cookies();
  const expectedState = cookieStore.get('meowl_oauth_state')?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL('/login?error=oauth', request.url));
  }

  cookieStore.delete('meowl_oauth_state');

  try {
    const accessToken = await exchangeCode(code);
    const user = await fetchDiscordUser(accessToken);

    if (!getAdminUserIds().has(user.id)) {
      return NextResponse.redirect(new URL('/login?error=forbidden', request.url));
    }

    const avatar = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
      : null;

    await setSessionCookie(createSessionToken({ userId: user.id, username: user.username, avatar }));
    return NextResponse.redirect(new URL('/', request.url));
  } catch {
    return NextResponse.redirect(new URL('/login?error=discord', request.url));
  }
}
