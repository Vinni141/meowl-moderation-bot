import { EmbedBuilder, type APIEmbedField, type Guild, type User } from 'discord.js';

export function successEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0x16a34a).setTitle(title).setDescription(description).setTimestamp();
}

export function infoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0x2563eb).setTitle(title).setDescription(description).setTimestamp();
}

export function moderationEmbed(fields: APIEmbedField[]): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle('Moderation Action')
    .addFields(fields.filter((field) => field.value.length > 0))
    .setTimestamp();
}

export type PublicActionEmbedInput = {
  action: string;
  icon?: string;
  target?: User;
  reason?: string;
  duration?: string;
  caseId?: number;
  details?: string;
};

export function publicActionEmbed(input: PublicActionEmbedInput): EmbedBuilder {
  const icon = input.icon ?? '✅';
  const title = input.target ? `${icon} ${input.target.username} ${input.action}` : `${icon} ${input.action}`;
  const lines = [
    input.reason ? `**Reason:** ${input.reason}` : undefined,
    input.duration ? `**Duration:** ${input.duration}` : undefined,
    input.details ? `**Details:** ${input.details}` : undefined,
  ].filter(Boolean);

  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle(title)
    .setDescription(lines.join('\n'))
    .setTimestamp();
}

export function compactStatusEmbed(description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0x22c55e).setDescription(description);
}

export function dmModerationEmbed(title: string, reason: string, guild: Guild, duration?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle(title)
    .addFields({ name: 'Reason:', value: reason });

  if (duration) {
    embed.addFields({ name: 'Duration:', value: duration });
  }

  return embed.setFooter({ text: `Sent from ${guild.name}` });
}
