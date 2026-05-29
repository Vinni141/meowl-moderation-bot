import type { Message, MessageCreateOptions } from 'discord.js';
import 'discord.js';

declare module 'discord.js' {
  interface PartialGroupDMChannel {
    send(options: MessageCreateOptions): Promise<Message>;
  }
}
