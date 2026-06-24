import { UserInputError } from '../lib/errors.js';

const units = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

const unitAliases = {
  s: 's',
  sec: 's',
  secs: 's',
  second: 's',
  seconds: 's',
  m: 'm',
  min: 'm',
  mins: 'm',
  minute: 'm',
  minutes: 'm',
  h: 'h',
  hr: 'h',
  hrs: 'h',
  hour: 'h',
  hours: 'h',
  d: 'd',
  day: 'd',
  days: 'd',
} as const;

export const DISCORD_TIMEOUT_MAX_MS = 28 * units.d;
export const GENERIC_DURATION_MAX_MS = 365 * units.d;

export type ParsedDuration = {
  input: string;
  milliseconds: number;
  expiresAt: Date;
};

type DurationUnitAlias = keyof typeof unitAliases;

function parseDurationParts(input: string): { amount: number; unit: keyof typeof units } | null {
  const match = /^(\d+)([a-z]+)$/.exec(input.trim().toLowerCase());
  if (!match) return null;

  const rawUnit = match[2] as DurationUnitAlias;
  const unit = unitAliases[rawUnit];
  if (!unit) return null;

  return {
    amount: Number(match[1]),
    unit,
  };
}

export function isDurationInput(input: string | undefined): boolean {
  return Boolean(input && parseDurationParts(input));
}

export function parseDuration(input: string, maxMs = GENERIC_DURATION_MAX_MS, now = new Date()): ParsedDuration {
  const trimmed = input.trim().toLowerCase();
  const duration = parseDurationParts(trimmed);

  if (!duration) {
    throw new UserInputError('Durations must use a format like 10s, 10sec, 5m, 1min, 2h, or 7d.');
  }

  const { amount, unit } = duration;

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
