import 'discord.js';

declare module 'discord.js' {
  interface PartialGroupDMChannel {
    send(options: unknown): Promise<unknown>;
  }
}
