import { requireSession } from '../lib/auth';
import { configurableCommands, parseDisabledCommands } from '../lib/commands';
import { getRequiredEnv } from '../lib/env';
import { prisma } from '../lib/prisma';

export const dynamic = 'force-dynamic';

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default async function DashboardPage() {
  const session = await requireSession();
  const guildId = getRequiredEnv('DISCORD_GUILD_ID');

  const [settings, logs, warnings, mutes, jails, tempRoles] = await Promise.all([
    prisma.guildSettings.findUnique({ where: { guildId } }),
    prisma.moderationLog.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
    prisma.warning.count({ where: { guildId, active: true } }),
    prisma.mute.count({ where: { guildId, active: true } }),
    prisma.jail.count({ where: { guildId, active: true } }),
    prisma.tempRole.count({ where: { guildId, active: true } }),
  ]);

  const disabledCommands = parseDisabledCommands(settings?.disabledCommands);
  const statCards = [
    { label: 'Active Warnings', value: warnings },
    { label: 'Active Mutes', value: mutes },
    { label: 'Active Jails', value: jails },
    { label: 'Temp Roles', value: tempRoles },
  ];

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Meowl Moderation</p>
          <h1>Dashboard</h1>
        </div>
        <div className="session-card">
          {session.avatar ? <img src={session.avatar} alt="" /> : <div className="avatar-fallback" />}
          <span>{session.username}</span>
          <form action="/api/auth/logout" method="post">
            <button className="ghost-button" type="submit">
              Logout
            </button>
          </form>
        </div>
      </header>

      <section className="stats-grid">
        {statCards.map((card) => (
          <article className="stat-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Command Controls</h2>
            <p>Changes are stored in Supabase and picked up by the bot immediately.</p>
          </div>
        </div>
        <div className="command-grid">
          {configurableCommands.map((command) => {
            const enabled = !disabledCommands.includes(command);
            return (
              <form action="/api/commands/toggle" className="command-row" key={command} method="post">
                <input name="command" type="hidden" value={command} />
                <input name="enabled" type="hidden" value={enabled ? 'false' : 'true'} />
                <div>
                  <strong>,{command}</strong>
                  <span>{enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <button className={enabled ? 'toggle-on' : 'toggle-off'} type="submit">
                  {enabled ? 'On' : 'Off'}
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Recent Moderation Logs</h2>
            <p>Latest stored actions for this Discord server.</p>
          </div>
        </div>
        <div className="log-list">
          {logs.length === 0 ? <p className="empty-state">No moderation logs yet.</p> : null}
          {logs.map((log) => (
            <article className="log-row" key={log.id}>
              <div>
                <strong>#{log.caseId} {log.action}</strong>
                <span>{log.reason ?? 'No reason provided'}</span>
              </div>
              <time>{formatDate(log.createdAt)}</time>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
