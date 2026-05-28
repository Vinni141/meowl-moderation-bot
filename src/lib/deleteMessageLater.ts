import type { Message } from 'discord.js';

export const BOT_MESSAGE_DELETE_AFTER_MS = 5_000;

export function deleteMessageLater(message: Message, delayMs = BOT_MESSAGE_DELETE_AFTER_MS): void {
  setTimeout(() => {
    void message.delete().catch(() => null);
  }, delayMs);
}
