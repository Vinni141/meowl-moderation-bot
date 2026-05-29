# Meowl Moderation Bot

Production-ready TypeScript Discord moderation bot with slash commands, comma-prefix commands, discord.js v14, Prisma, Supabase PostgreSQL, dotenv, Zod, ESLint, Prettier, Vitest, and a separate Vercel dashboard.

## Architecture

- `src/commands`: small slash command files that read Discord options and call services.
- `src/services`: business logic for moderation, jail, roles, AFK, logging, scheduler, prefix commands, sniping, dashboard helpers, and permissions.
- `src/events`: Discord events such as ready, interactions, messages, deleted messages, and safety events.
- `src/database`: Prisma Client for the bot.
- `prisma/schema.prisma`: shared database schema for Supabase PostgreSQL.
- `dashboard`: separate Next.js dashboard for Vercel Free.

Moderator slash-command replies are ephemeral. Prefix-command replies are normal channel replies and are deleted automatically where the command behavior expects it. Errors are converted into safe embeds and internal stack traces are never sent to Discord.

## Free Hosting Setup

Recommended free setup:

- Bot runtime: bxhost
- Database: Supabase Free PostgreSQL
- Dashboard: Vercel Free
- Code: GitHub

This avoids storing real moderation data in a temporary SQLite file inside a container.

## Bot Environment

Create `.env` from `.env.example` for local development, or add the same values in bxhost:

```env
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
MOD_LOG_CHANNEL_ID=
DASHBOARD_ENABLED=false
DASHBOARD_PORT=3000
DASHBOARD_ADMIN_TOKEN=
DUCKDNS_DOMAIN=
DUCKDNS_TOKEN=
```

For bxhost, set `DASHBOARD_ENABLED=false` because the public dashboard is deployed separately on Vercel.

## Supabase

1. Create a free Supabase project.
2. Open Project Settings -> Database.
3. Copy the PostgreSQL connection string.
4. Put it into `DATABASE_URL`.
5. Deploy the bot or run `pnpm db:push` once so Prisma creates the tables.

The URL must start with `postgresql://`. The old SQLite value `file:/app/data/dev.db` is no longer used for hosting.

## Discord Developer Portal

1. Create or open your Application.
2. Create a Bot user and copy the token to `DISCORD_BOT_TOKEN`.
3. Copy the Application ID to `DISCORD_CLIENT_ID`.
4. Enable `Server Members Intent`.
5. Enable `Message Content Intent` for AFK mention handling and comma-prefix commands.
6. For the Vercel dashboard, add this OAuth redirect URL:

```text
https://your-vercel-app.vercel.app/api/auth/discord/callback
```

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

## Running Locally

```bash
pnpm install
pnpm db:push
pnpm register-commands
pnpm dev
```

## bxhost

Use the GitHub repository as source. The included `Dockerfile` builds and starts the bot.

Required bxhost environment variables:

```env
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
MOD_LOG_CHANNEL_ID=
DASHBOARD_ENABLED=false
```

The container start command runs:

```bash
pnpm db:push && pnpm start
```

## Vercel Dashboard

Deploy the `dashboard` folder as its own Vercel project.

Vercel settings:

- Framework Preset: Next.js
- Root Directory: `dashboard`
- Build Command: `pnpm build`
- Output Directory: leave default

Required Vercel environment variables:

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI="https://your-vercel-app.vercel.app/api/auth/discord/callback"
DISCORD_GUILD_ID=
ADMIN_USER_IDS="your-discord-user-id"
DASHBOARD_SESSION_SECRET="use-a-long-random-secret-at-least-32-characters"
```

Only Discord users listed in `ADMIN_USER_IDS` can open the dashboard. For multiple admins, separate IDs with commas:

```env
ADMIN_USER_IDS="123,456,789"
```

The dashboard can:

- show active warnings, mutes, jails, and temporary roles
- show recent moderation logs
- enable or disable individual bot commands

## Commands

Slash commands:

- `/warn user reason`
- `/mute user duration reason`
- `/kick user reason`
- `/ban user reason delete_messages_days`
- `/unban user reason`
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
- `/modlog channel`

Prefix commands use `,`:

- `,warn @user reason`
- `,warns @user`
- `,cases @user`
- `,listcommands`
- `,mute @user 10m reason`
- `,kick @user reason`
- `,ban @user 0 reason`
- `,unban userId reason`
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
- `,modlog #channel`
- `,nickname @user new nickname`

Warnings expire automatically after 30 days. Mutes, jails, and temporary roles are processed by the scheduler.

Ban commands require a Discord button confirmation before the ban is executed. `,s` snipes deleted non-bot messages in the current channel, for example `,s 2` for the last two deleted messages.

## Jail Setup

Jail is account isolation for compromised or scam-suspected accounts, not a normal mute.

1. Create a role such as `jailed`.
2. Create a text channel for jail communication.
3. Run `/jailsetup role:<jailed> channel:<jail-channel>` or `,jailsetup @jailed #jail-channel`.
4. The bot attempts to deny `ViewChannel`, `SendMessages`, `AddReactions`, and related send permissions for the jail role in all non-jail channels.
5. The bot allows `ViewChannel`, `SendMessages`, and `ReadMessageHistory` in the jail channel.

If overwrites cannot be set, the command reports the affected channels so you can configure them manually.

## Role Hierarchy

Discord only allows role and member actions when hierarchy allows it:

- The moderator must be above the target user or target role.
- The bot must be above the target user, jail role, and managed roles.
- Managed roles, bot roles, and integration roles are not assigned or removed.

Jail stores previous roles and restores what the bot can restore during unjail.
