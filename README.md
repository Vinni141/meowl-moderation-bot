# Discord Moderation Bot

Production-ready TypeScript Discord moderation bot with slash commands, comma-prefix commands, discord.js v14, Prisma, SQLite, dotenv, Zod, ESLint, Prettier, and Vitest.

## Architecture

- `src/commands`: small slash command files that read options and call services.
- `src/services`: business logic for moderation, jail, roles, AFK, logging, scheduler, duration parsing, prefix commands, and permissions.
- `src/events`: `ready`, `interactionCreate`, `messageCreate`, and error handling.
- `src/database`: Prisma Client.
- `prisma/schema.prisma`: SQLite models for settings, logs, warnings, mutes, jails, temp roles, and AFK.

Moderator slash-command replies are ephemeral. Prefix-command replies are normal channel replies. Errors are converted into safe embeds and internal stack traces are never sent to Discord.

## Setup

```bash
pnpm install
```

Create `.env` from `.env.example`:

```env
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
DATABASE_URL="file:./dev.db"
MOD_LOG_CHANNEL_ID=
DASHBOARD_ENABLED=true
DASHBOARD_PORT=3000
DASHBOARD_ADMIN_TOKEN=change-this-to-a-long-random-token
DUCKDNS_DOMAIN=
DUCKDNS_TOKEN=
```

## Discord Developer Portal

1. Create or open your Application.
2. Create a Bot user and copy the token to `DISCORD_BOT_TOKEN`.
3. Copy the Application ID to `DISCORD_CLIENT_ID`.
4. Enable `Server Members Intent`.
5. Enable `Message Content Intent` for AFK mention handling and comma-prefix commands.

## Invite Permissions

OAuth2 scopes: `bot`, `applications.commands`

Required bot permissions:

- Manage Roles
- Manage Channels
- Manage Messages
- Moderate Members
- Kick Members
- Ban Members
- View Audit Log
- Read Message History
- Send Messages
- View Channels
- Use Slash Commands

The bot role must be above every role it should manage.

## Commands

Slash commands:

- `/warn user reason`
- `/mute user duration reason`
- `/kick user reason`
- `/ban user reason delete_messages_days`
- `/jailsetup role channel`
- `/jail user reason duration`
- `/unjail user reason`
- `/afk reason`
- `/roleadd user role reason`
- `/roleremove user role reason`
- `/temproleadd user role duration reason`
- `/purge amount user reason`
- `/slowmode seconds reason`
- `/lock channel reason`
- `/unlock channel reason`

Prefix commands use `,`:

- `,warn @user reason`
- `,mute @user 10m reason`
- `,kick @user reason`
- `,ban @user 0 reason`
- `,s`
- `,s 2`
- `,jailsetup @role #channel`
- `,jail @user 7d reason`
- `,unjail @user reason`
- `,afk reason`
- `,roleadd @user @role reason`
- `,roleremove @user @role reason`
- `,temproleadd @user @role 7d reason`
- `,purge 20`
- `,slowmode 5 reason`
- `,lock #channel reason`
- `,unlock #channel reason`

Warnings expire automatically after 30 days. Mutes, jails, and temporary roles are processed by the scheduler.
Ban commands require a Discord button confirmation before the ban is executed. `,s` snipes deleted non-bot messages in the current channel, for example `,s 2` for the last two deleted messages.

## Running

```bash
pnpm db:push
pnpm register-commands
pnpm dev
```

After schema changes, run `pnpm db:push` again.

## Web Dashboard

The bot includes a small built-in dashboard without extra dependencies.

Set these values in `.env`:

```env
DASHBOARD_ENABLED=true
DASHBOARD_PORT=3000
DASHBOARD_ADMIN_TOKEN=use-a-long-random-secret
```

Start the bot and open:

```text
http://localhost:3000
```

Enter the dashboard token from `.env`.

The dashboard shows:

- server and bot status
- member count
- active warnings
- active mutes
- active jails
- active temporary roles
- command toggles to enable or disable individual commands
- recent moderation logs

## DuckDNS Hosting

DuckDNS points a public subdomain to the machine running the bot, but the bot cannot configure your router automatically.

1. Create a DuckDNS subdomain, for example `mybot.duckdns.org`.
2. Put the values in `.env` for documentation:

```env
DUCKDNS_DOMAIN=mybot
DUCKDNS_TOKEN=your-duckdns-token
```

3. Forward a port on your router to the dashboard machine, for example public `3000` to local `3000`.
4. Allow the port through Windows Firewall.
5. Open:

```text
http://mybot.duckdns.org:3000
```

For a real public deployment, put the dashboard behind HTTPS with a reverse proxy such as Caddy or Nginx and keep `DASHBOARD_ADMIN_TOKEN` private.

## Jail Setup

Jail is account isolation for compromised or scam-suspected accounts, not a normal mute.

1. Create a role such as `jailed`.
2. Create a text channel for jail communication.
3. Run `/jailsetup role:<jailed> channel:<jail-channel>` or `,jailsetup @jailed #jail-channel`.
4. The bot attempts to deny `ViewChannel` and `SendMessages` for the jail role in normal text channels.
5. The bot allows `ViewChannel`, `SendMessages`, and `ReadMessageHistory` in the jail channel.

If overwrites cannot be set, the command reports the affected channels so you can configure them manually.

## Role Hierarchy

Discord only allows role and member actions when hierarchy allows it:

- The moderator must be above the target user or target role.
- The bot must be above the target user, jail role, and managed roles.
- Managed roles, bot roles, and integration roles are not assigned or removed.

Jail stores previous roles and restores what the bot can restore during unjail.
