import 'dotenv/config';
import { z } from 'zod';

const testDefaults =
  process.env.VITEST === 'true'
    ? {
        DISCORD_BOT_TOKEN: 'test-token',
        DISCORD_CLIENT_ID: 'test-client',
        DISCORD_GUILD_ID: 'test-guild',
        DATABASE_URL: 'file:./test.db',
      }
    : {};

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  MOD_LOG_CHANNEL_ID: z.string().optional().default(''),
  DASHBOARD_ENABLED: z
    .string()
    .optional()
    .default('true')
    .transform((value) => value.toLowerCase() === 'true'),
  DASHBOARD_PORT: z.coerce.number().int().min(1).max(65535).optional().default(3000),
  DASHBOARD_ADMIN_TOKEN: z.preprocess((value) => (value === '' ? undefined : value), z.string().optional()),
  DUCKDNS_DOMAIN: z.string().optional().default(''),
  DUCKDNS_TOKEN: z.string().optional().default(''),
});

export const config = envSchema.parse({ ...testDefaults, ...process.env });
