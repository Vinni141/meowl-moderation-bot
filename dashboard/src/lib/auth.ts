import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRequiredEnv } from './env';

const sessionCookieName = 'meowl_session';

type SessionPayload = {
  userId: string;
  username: string;
  avatar: string | null;
  guilds: SessionGuild[];
  expiresAt: number;
};

export type SessionGuild = {
  id: string;
  name: string;
  icon: string | null;
};

function base64Url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getRequiredEnv('DASHBOARD_SESSION_SECRET')).update(payload).digest('base64url');
}

export function createSessionToken(payload: Omit<SessionPayload, 'expiresAt'>): string {
  const body = base64Url(
    JSON.stringify({
      ...payload,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
    }),
  );

  return `${body}.${sign(body)}`;
}

export function readSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature || sign(body) !== signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (payload.expiresAt < Date.now()) return null;
    if (!Array.isArray(payload.guilds) || payload.guilds.length === 0) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return readSessionToken(cookieStore.get(sessionCookieName)?.value);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireGuildAccess(guildId: string): Promise<SessionPayload> {
  const session = await requireSession();
  if (!session.guilds.some((guild) => guild.id === guildId)) redirect('/login?error=forbidden');
  return session;
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}
