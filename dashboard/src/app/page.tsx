import { Suspense } from 'react';
import { requireSession } from '../lib/auth';
import { configurableCommands, parseDisabledCommands } from '../lib/commands';
import { getRequiredEnv } from '../lib/env';
import { prisma } from '../lib/prisma';
import { CommandSwitches } from './components/command-switches';

export const dynamic = 'force-dynamic';

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

async function StatsSection({ guildId }: { guildId: string }) {
  const [warnings, mutes, jails, tempRoles] = await Promise.all([
    prisma.warning.count({ where: { guildId, active: true } }),
    prisma.mute.count({ where: { guildId, active: true } }),
    prisma.jail.count({ where: { guildId, active: true } }),
    prisma.tempRole.count({ where: { guildId, active: true } }),
  ]);

  const statCards = [
    { label: 'Active Warnings', value: warnings },
    { label: 'Active Mutes', value: mutes },
    { label: 'Active Jails', value: jails },
    { label: 'Temp Roles', value: tempRoles },
  ];

  return (
    <section className="stats-grid">
      {statCards.map((card) => (
        <article className="stat-card" key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </article>
      ))}
    </section>
  );
}

function StatsSkeleton() {
  return (
    <section className="stats-grid" aria-label="Loading stats">
      {['Active Warnings', 'Active Mutes', 'Active Jails', 'Temp Roles'].map((label) => (
        <article className="stat-card stat-card-loading" key={label}>
          <span>{label}</span>
          <strong>...</strong>
        </article>
      ))}
    </section>
  );
}

async function LogsSection({ guildId }: { guildId: string }) {
  const logs = await prisma.moderationLog.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });

  return (
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
  );
}

function LogsSkeleton() {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Recent Moderation Logs</h2>
          <p>Loading latest actions...</p>
        </div>
      </div>
      <div className="log-list">
        <article className="log-row log-row-loading">
          <div>
            <strong>Loading...</strong>
            <span>Please wait</span>
          </div>
        </article>
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const guildId = getRequiredEnv('DISCORD_GUILD_ID');
  const settings = await prisma.guildSettings.findUnique({ where: { guildId } });
  const disabledCommands = parseDisabledCommands(settings?.disabledCommands);

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

      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection guildId={guildId} />
      </Suspense>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Command Controls</h2>
            <p>Changes are stored in Supabase and picked up by the bot immediately.</p>
          </div>
        </div>
        <CommandSwitches commands={configurableCommands} disabledCommands={disabledCommands} />
      </section>

      <Suspense fallback={<LogsSkeleton />}>
        <LogsSection guildId={guildId} />
      </Suspense>
    </main>
  );
}
