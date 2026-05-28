import type { Message, PartialMessage } from 'discord.js';
import { recordDeletedMessage } from '../services/snipeService.js';

export async function handleMessageDelete(message: Message | PartialMessage): Promise<void> {
  if (message.partial) return;
  recordDeletedMessage(message as Message);
}
