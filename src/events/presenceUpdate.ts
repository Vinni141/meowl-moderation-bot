import type { Presence } from 'discord.js';
import { applyStatusRoleFromPresence } from '../services/statusRoleService.js';

export async function handlePresenceUpdate(_oldPresence: Presence | null, newPresence: Presence): Promise<void> {
  await applyStatusRoleFromPresence(newPresence);
}
