import { EmbedBuilder, type Message } from 'discord.js';
import { UserInputError } from '../lib/errors.js';

type SnipedMessage = {
  authorId: string;
  authorTag: string;
  authorAvatarUrl: string;
  content: string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt: Date;
  deletedAt: Date;
};

const snipes = new Map<string, SnipedMessage[]>();
const MAX_SNIPES_PER_CHANNEL = 50;
const MAX_SNIPES_PER_COMMAND = 10;

function key(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`;
}

export function recordDeletedMessage(message: Message): void {
  if (!message.guild || message.author?.bot) return;
  const attachment = message.attachments.first();
  const content = message.content?.trim() || '';
  if (content.startsWith(',')) return;
  if (!content && !attachment) return;

  const channelKey = key(message.guild.id, message.channel.id);
  const messages = snipes.get(channelKey) ?? [];
  messages.unshift({
    authorId: message.author.id,
    authorTag: message.author.tag,
    authorAvatarUrl: message.author.displayAvatarURL(),
    content,
    attachmentUrl: attachment?.url,
    attachmentName: attachment?.name ?? undefined,
    createdAt: message.createdAt,
    deletedAt: new Date(),
  });
  snipes.set(channelKey, messages.slice(0, MAX_SNIPES_PER_CHANNEL));
}

export function buildSnipeEmbed(message: Message, amount = 1): { embeds: EmbedBuilder[] } {
  if (!message.guild || !message.member) throw new UserInputError('This command can only be used in a server.');
  if (!Number.isInteger(amount) || amount < 1) throw new UserInputError('Usage: ,s or ,s 2');

  const requestedAmount = Math.min(amount, MAX_SNIPES_PER_COMMAND);
  const channelSnipes = snipes.get(key(message.guild.id, message.channel.id)) ?? [];
  const selectedSnipes = channelSnipes.slice(0, requestedAmount);
  if (!selectedSnipes.length) throw new UserInputError('There is no deleted message to snipe in this channel.');

  if (selectedSnipes.length === 1) {
    const snipe = selectedSnipes[0]!;
    const embed = new EmbedBuilder()
      .setColor(0x38bdf8)
      .setAuthor({ name: snipe.authorTag, iconURL: snipe.authorAvatarUrl })
      .setDescription(snipe.content || '*No text content*')
      .addFields(
        { name: 'Author', value: `<@${snipe.authorId}>`, inline: true },
        { name: 'Deleted', value: `<t:${Math.floor(snipe.deletedAt.getTime() / 1000)}:R>`, inline: true },
      )
      .setFooter({ text: `Sent ${snipe.createdAt.toLocaleString()}` })
      .setTimestamp(snipe.deletedAt);

    if (snipe.attachmentUrl) {
      embed.addFields({ name: 'Attachment', value: snipe.attachmentUrl, inline: false });
      if (/\.(png|jpe?g|gif|webp)$/i.test(snipe.attachmentUrl)) {
        embed.setImage(snipe.attachmentUrl);
      }
    }

    return { embeds: [embed] };
  }

  const lines = selectedSnipes.map((snipe, index) => {
    const content = snipe.content || (snipe.attachmentUrl ? '[Attachment only]' : '*No text content*');
    const trimmed = content.length > 240 ? `${content.slice(0, 237)}...` : content;
    const attachment = snipe.attachmentUrl ? `\n> Attachment: ${snipe.attachmentUrl}` : '';
    return `**${index + 1}. ${snipe.authorTag}** <t:${Math.floor(
      snipe.deletedAt.getTime() / 1000,
    )}:R>\n> ${trimmed}${attachment}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x38bdf8)
    .setTitle(`Last ${selectedSnipes.length} Deleted Messages`)
    .setDescription(lines.join('\n\n'))
    .setFooter({
      text:
        amount > MAX_SNIPES_PER_COMMAND
          ? `Showing max ${MAX_SNIPES_PER_COMMAND} messages`
          : `Stored max ${MAX_SNIPES_PER_CHANNEL} messages per channel`,
    })
    .setTimestamp();

  return { embeds: [embed] };
}
