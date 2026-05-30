import Link from 'next/link';

export const dynamic = 'force-dynamic';

const errorMessages: Record<string, string> = {
  oauth: 'Discord login could not be verified.',
  forbidden: 'You need administrator permissions on a server where this bot is installed.',
  discord: 'Discord login failed. Try again.',
};

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const error = params?.error ? errorMessages[params.error] : null;

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark">M</div>
        <h1>Meowl Moderation</h1>
        <p>Sign in with Discord to manage servers where you have administrator permissions.</p>
        {error ? <div className="error-box">{error}</div> : null}
        <Link className="primary-button" href="/api/auth/discord/start">
          Continue with Discord
        </Link>
      </section>
    </main>
  );
}
