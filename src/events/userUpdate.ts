import type { Client, PartialUser, User } from 'discord.js';
import { applyServerTagRoleFromUser } from '../services/statusRoleService.js';

export async function handleUserUpdate(client: Client, _oldUser: User | PartialUser, newUser: User | PartialUser): Promise<void> {
  if (!client.isReady()) return;
  if (newUser.partial) return;
  await applyServerTagRoleFromUser(client, newUser);
}
