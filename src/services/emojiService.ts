import type { Guild } from 'discord.js';

const emojiNames = {
  check: 'check',
  cross: 'cross',
  warn: 'warn',
  lightbulb: 'lightbulb',
  questionMark: 'question_mark',
  upgrade: 'upgrade',
  hammer: 'hammer',
  firstTrophy: '1stTrophy',
  secondTrophy: '2ndTrophy',
  thirdTrophy: '3rdTrophy',
  heart: 'heart',
  star: 'Star',
} as const;

type EmojiKey = keyof typeof emojiNames;

const fallbacks: Record<EmojiKey, string> = {
  check: '\u2705',
  cross: '\u274c',
  warn: '\u26a0\ufe0f',
  lightbulb: '\ud83d\udca1',
  questionMark: '\u2753',
  upgrade: '\u23eb',
  hammer: '\ud83d\udd28',
  firstTrophy: '\ud83c\udfc6',
  secondTrophy: '\ud83c\udfc6',
  thirdTrophy: '\ud83c\udfc6',
  heart: '\u2764',
  star: '\u2b50',
};

export function serverEmoji(guild: Guild | null | undefined, key: EmojiKey): string {
  return guild?.emojis.cache.find((emoji) => emoji.name === emojiNames[key])?.toString() ?? fallbacks[key];
}
