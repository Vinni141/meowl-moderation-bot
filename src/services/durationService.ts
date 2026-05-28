import { UserInputError } from '../lib/errors.js';

const units = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

export const DISCORD_TIMEOUT_MAX_MS = 28 * units.d;
export const GENERIC_DURATION_MAX_MS = 365 * units.d;

export type ParsedDuration = {
  input: string;
  milliseconds: number;
  expiresAt: Date;
};

export function parseDuration(input: string, maxMs = GENERIC_DURATION_MAX_MS, now = new Date()): ParsedDuration {
  const trimmed = input.trim().toLowerCase();
  const match = /^(\d+)([smhd])$/.exec(trimmed);

  if (!match) {
    throw new UserInputError('Durations must use the format 10s, 5m, 2h, or 7d.');
  }

  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof units;

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new UserInputError('The duration must be greater than 0.');
  }

  const milliseconds = amount * units[unit];
  if (milliseconds > maxMs) {
    throw new UserInputError('The duration is too long.');
  }

  return {
    input: trimmed,
    milliseconds,
    expiresAt: new Date(now.getTime() + milliseconds),
  };
}
