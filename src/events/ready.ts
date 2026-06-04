import type { Client } from 'discord.js';
import { startDashboard } from '../services/dashboardService.js';
import { startScheduler } from '../services/schedulerService.js';
import { syncKnownStatusRoles } from '../services/statusRoleService.js';

let scheduler: NodeJS.Timeout | undefined;

export async function handleReady(client: Client<true>): Promise<void> {
  console.log(`Bot online as ${client.user.tag}`);
  if (!scheduler) scheduler = startScheduler(client);
  await syncKnownStatusRoles(client);
  startDashboard(client);
}
