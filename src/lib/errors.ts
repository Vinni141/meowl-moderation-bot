import { EmbedBuilder } from 'discord.js';

export class AppError extends Error {
  public readonly title: string;

  public constructor(message: string, title = 'Error') {
    super(message);
    this.title = title;
  }
}

export class UserInputError extends AppError {
  public constructor(message: string) {
    super(message, 'Invalid Input');
  }
}

export class PermissionError extends AppError {
  public constructor(message: string) {
    super(message, 'Missing Permission');
  }
}

export class BotPermissionError extends AppError {
  public constructor(message: string) {
    super(message, 'Bot Permission Missing');
  }
}

export class NotFoundError extends AppError {
  public constructor(message: string) {
    super(message, 'Not Found');
  }
}

export class ModerationActionError extends AppError {
  public constructor(message: string) {
    super(message, 'Action Failed');
  }
}

export function errorToEmbed(error: unknown): EmbedBuilder {
  if (error instanceof AppError) {
    return new EmbedBuilder().setColor(0xdc2626).setTitle(error.title).setDescription(error.message);
  }

  console.error(error);
  return new EmbedBuilder()
    .setColor(0xdc2626)
    .setTitle('Internal Error')
    .setDescription('The action could not be completed.');
}
