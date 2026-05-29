import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { Client } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { config } from '../lib/config.js';
import { getCommandStates, setCommandEnabled } from './commandSettingsService.js';

type DashboardStats = {
  guildName: string;
  botTag: string;
  memberCount: number;
  commands: number;
  warnings: number;
  activeMutes: number;
  activeJails: number;
  activeTempRoles: number;
  commandStates: Array<{ name: string; enabled: boolean }>;
  recentLogs: Array<{
    caseId: number;
    action: string;
    targetUserId: string | null;
    moderatorId: string | null;
    reason: string | null;
    createdAt: string;
  }>;
};

let dashboardServer: Server | undefined;

export function startDashboard(client: Client): Server | undefined {
  if (!config.DASHBOARD_ENABLED) return undefined;
  if (!config.DASHBOARD_ADMIN_TOKEN || config.DASHBOARD_ADMIN_TOKEN.length < 16) {
    console.warn('Dashboard disabled: DASHBOARD_ADMIN_TOKEN must be at least 16 characters.');
    return undefined;
  }
  if (dashboardServer) return dashboardServer;

  dashboardServer = createServer((request, response) => {
    void handleRequest(client, request, response);
  });

  dashboardServer.listen(config.DASHBOARD_PORT, () => {
    console.log(`Dashboard running at http://localhost:${config.DASHBOARD_PORT}`);
  });

  return dashboardServer;
}

export async function stopDashboard(): Promise<void> {
  if (!dashboardServer) return;
  await new Promise<void>((resolve) => dashboardServer?.close(() => resolve()));
  dashboardServer = undefined;
}

async function handleRequest(client: Client, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (url.pathname === '/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (!isAuthorized(request, url)) {
    if (url.pathname.startsWith('/api/')) {
      sendJson(response, 401, { error: 'Unauthorized' });
      return;
    }
    sendHtml(response, 401, loginPage());
    return;
  }

  if (url.pathname === '/') {
    sendHtml(response, 200, dashboardPage());
    return;
  }

  if (url.pathname === '/api/stats') {
    sendJson(response, 200, await getDashboardStats(client));
    return;
  }

  if (url.pathname === '/api/commands/toggle' && request.method === 'POST') {
    const body = await readJsonBody<{ commandName?: string; enabled?: boolean }>(request);
    if (!body.commandName || typeof body.enabled !== 'boolean') {
      sendJson(response, 400, { error: 'commandName and enabled are required' });
      return;
    }

    await setCommandEnabled(config.DISCORD_GUILD_ID, body.commandName, body.enabled);
    sendJson(response, 200, { commandStates: await getCommandStates(config.DISCORD_GUILD_ID) });
    return;
  }

  sendJson(response, 404, { error: 'Not found' });
}

function isAuthorized(request: IncomingMessage, url: URL): boolean {
  if (!config.DASHBOARD_ADMIN_TOKEN) return false;
  const authorization = request.headers.authorization;
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
  const token = bearer ?? url.searchParams.get('token') ?? request.headers['x-dashboard-token'];
  return token === config.DASHBOARD_ADMIN_TOKEN;
}

async function getDashboardStats(client: Client): Promise<DashboardStats> {
  const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
  const fullGuild = await guild.fetch();
  const [
    warnings,
    activeMutes,
    activeJails,
    activeTempRoles,
    recentLogs,
    commandStates,
  ] = await Promise.all([
    prisma.warning.count({ where: { guildId: guild.id, active: true, expiresAt: { gt: new Date() } } }),
    prisma.mute.count({ where: { guildId: guild.id, active: true } }),
    prisma.jail.count({ where: { guildId: guild.id, active: true } }),
    prisma.tempRole.count({ where: { guildId: guild.id, active: true } }),
    prisma.moderationLog.findMany({
      where: { guildId: guild.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        caseId: true,
        action: true,
        targetUserId: true,
        moderatorId: true,
        reason: true,
        createdAt: true,
      },
    }),
    getCommandStates(guild.id),
  ]);

  return {
    guildName: fullGuild.name,
    botTag: client.user?.tag ?? 'Unknown',
    memberCount: fullGuild.memberCount,
    commands: 22,
    warnings,
    activeMutes,
    activeJails,
    activeTempRoles,
    commandStates,
    recentLogs: recentLogs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString('utf8');
  return body ? (JSON.parse(body) as T) : ({} as T);
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function sendHtml(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(body);
}

function loginPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bot Dashboard Login</title>
  <style>${dashboardCss()}</style>
</head>
<body>
  <main class="login">
    <form onsubmit="event.preventDefault(); location.href='/?token=' + encodeURIComponent(document.querySelector('#token').value)">
      <h1>Dashboard Access</h1>
      <input id="token" type="password" autocomplete="current-password" placeholder="Admin token" autofocus />
      <button type="submit">Open Dashboard</button>
    </form>
  </main>
</body>
</html>`;
}

function dashboardPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Moderation Dashboard</title>
  <style>${dashboardCss()}</style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div>
        <p class="eyebrow">Discord Moderation</p>
        <h1 id="guildName">Loading...</h1>
        <p id="botTag" class="muted">Connecting to bot data</p>
      </div>
      <button onclick="loadStats()">Refresh</button>
    </section>

    <section class="stats">
      <article><span>Members</span><strong id="memberCount">-</strong></article>
      <article><span>Commands</span><strong id="commands">-</strong></article>
      <article><span>Active Warns</span><strong id="warnings">-</strong></article>
      <article><span>Active Mutes</span><strong id="activeMutes">-</strong></article>
      <article><span>Active Jails</span><strong id="activeJails">-</strong></article>
      <article><span>Temp Roles</span><strong id="activeTempRoles">-</strong></article>
    </section>

    <section class="panel">
      <div class="panelHead">
        <h2>Command Toggles</h2>
        <span>Enable or disable commands instantly</span>
      </div>
      <div id="commandGrid" class="commandGrid"></div>
    </section>

    <section class="panel">
      <div class="panelHead">
        <h2>Recent Moderation Logs</h2>
        <span id="updatedAt">Never updated</span>
      </div>
      <div class="tableWrap">
        <table>
          <thead><tr><th>Case</th><th>Action</th><th>User</th><th>Moderator</th><th>Reason</th><th>Date</th></tr></thead>
          <tbody id="logs"></tbody>
        </table>
      </div>
    </section>
  </main>
  <script>
    const token = new URLSearchParams(location.search).get('token') || localStorage.getItem('dashboardToken') || '';
    if (token) localStorage.setItem('dashboardToken', token);
    async function loadStats() {
      const response = await fetch('/api/stats', { headers: { Authorization: 'Bearer ' + token } });
      if (!response.ok) { location.href = '/'; return; }
      const data = await response.json();
      for (const key of ['guildName','botTag','memberCount','commands','warnings','activeMutes','activeJails','activeTempRoles']) {
        document.getElementById(key).textContent = data[key];
      }
      document.getElementById('updatedAt').textContent = 'Updated ' + new Date().toLocaleTimeString();
      document.getElementById('commandGrid').innerHTML = data.commandStates.map((command) =>
        '<label class="toggleRow">' +
          '<span>,' + escapeHtml(command.name) + '</span>' +
          '<input type="checkbox" ' + (command.enabled ? 'checked' : '') + ' onchange="toggleCommand(\\'' + escapeHtml(command.name) + '\\', this.checked)" />' +
        '</label>'
      ).join('');
      document.getElementById('logs').innerHTML = data.recentLogs.map((log) =>
        '<tr>' +
          '<td>#' + log.caseId + '</td>' +
          '<td><span class="pill">' + escapeHtml(log.action) + '</span></td>' +
          '<td>' + (log.targetUserId ? '&lt;@' + log.targetUserId + '&gt;' : '-') + '</td>' +
          '<td>' + (log.moderatorId ? '&lt;@' + log.moderatorId + '&gt;' : 'System') + '</td>' +
          '<td>' + escapeHtml(log.reason || '-') + '</td>' +
          '<td>' + new Date(log.createdAt).toLocaleString() + '</td>' +
        '</tr>'
      ).join('');
    }
    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
    }
    async function toggleCommand(commandName, enabled) {
      const response = await fetch('/api/commands/toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ commandName, enabled })
      });
      if (!response.ok) {
        alert('Could not update command.');
        await loadStats();
      }
    }
    loadStats();
    setInterval(loadStats, 30000);
  </script>
</body>
</html>`;
}

function dashboardCss(): string {
  return `
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, Segoe UI, sans-serif; background: #101114; color: #f4f7fb; }
    body { margin: 0; min-height: 100vh; background: radial-gradient(circle at top left, #203447 0, #101114 34rem); }
    .shell { width: min(1180px, calc(100vw - 32px)); margin: 0 auto; padding: 32px 0; }
    .hero { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 28px 0; }
    .eyebrow { color: #3ee28f; font-weight: 700; margin: 0 0 8px; text-transform: uppercase; font-size: 12px; letter-spacing: .08em; }
    h1 { font-size: 42px; line-height: 1.05; margin: 0; }
    h2 { margin: 0; font-size: 18px; }
    .muted, .panelHead span { color: #9ba7b4; }
    button { border: 0; background: #22c55e; color: #08110c; font-weight: 800; padding: 11px 16px; border-radius: 8px; cursor: pointer; }
    .stats { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
    article, .panel, .login form { border: 1px solid #2c323a; background: rgba(25, 28, 34, .92); border-radius: 8px; box-shadow: 0 12px 36px rgba(0,0,0,.24); }
    article { padding: 18px; }
    article span { color: #9ba7b4; display: block; font-size: 13px; }
    article strong { display: block; margin-top: 10px; font-size: 30px; }
    .panel { margin-top: 16px; overflow: hidden; }
    .panelHead { display: flex; align-items: center; justify-content: space-between; padding: 18px; border-bottom: 1px solid #2c323a; }
    .tableWrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 820px; }
    th, td { text-align: left; padding: 13px 18px; border-bottom: 1px solid #262b33; font-size: 14px; vertical-align: top; }
    th { color: #9ba7b4; font-size: 12px; text-transform: uppercase; }
    .pill { background: #273b30; color: #7df2aa; border: 1px solid #335d42; padding: 4px 8px; border-radius: 999px; font-size: 12px; font-weight: 800; }
    .commandGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 18px; }
    .toggleRow { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #151a21; border: 1px solid #2c323a; border-radius: 8px; padding: 12px; font-weight: 800; }
    .toggleRow input { width: 42px; height: 22px; accent-color: #22c55e; cursor: pointer; }
    .login { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .login form { width: min(420px, 100%); padding: 24px; display: grid; gap: 14px; }
    input { background: #11151b; color: #f4f7fb; border: 1px solid #343b46; border-radius: 8px; padding: 12px; font: inherit; }
    @media (max-width: 900px) { .stats, .commandGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .hero { align-items: flex-start; flex-direction: column; } h1 { font-size: 34px; } }
    @media (max-width: 560px) { .stats, .commandGrid { grid-template-columns: 1fr; } }
  `;
}
