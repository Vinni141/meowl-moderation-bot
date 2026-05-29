import Link from 'next/link';

export const dynamic = 'force-dynamic';

const errorMessages: Record<string, string> = {
  oauth: 'Discord login could not be verified.',
  forbidden: 'Your Discord account is not allowed to access this dashboard.',
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
        <p>Sign in with an approved Discord account to manage bot settings.</p>
        {error ? <div className="error-box">{error}</div> : null}
        <Link className="primary-button" href="/api/auth/discord/start">
          Continue with Discord
        </Link>
      </section>
    </main>
  );
}
