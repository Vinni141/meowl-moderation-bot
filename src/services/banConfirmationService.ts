import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
  type GuildMember,
  type MessageCreateOptions,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { UserInputError } from '../lib/errors.js';
import { publicActionEmbed } from './embedService.js';
import { banUser } from './moderationService.js';

type PendingBan = {
  moderatorId: string;
  targetId: string;
  reason: string;
  deleteMessageDays: number;
  channelId?: string;
  expiresAt: number;
};

const pendingBans = new Map<string, PendingBan>();
const CONFIRMATION_TTL_MS = 60_000;

function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function banConfirmationEmbed(target: GuildMember, reason: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle('Confirm Ban')
    .setDescription(`Are you sure you want to ban **${target.user.username}**?`)
    .addFields(
      { name: 'User', value: `${target} (${target.id})`, inline: false },
      { name: 'Reason', value: reason, inline: false },
    )
    .setTimestamp();
}

export function createBanConfirmation(
  moderator: GuildMember,
  target: GuildMember,
  reason: string,
  deleteMessageDays: number,
  channelId?: string,
): MessageCreateOptions {
  const id = createId();
  pendingBans.set(id, {
    moderatorId: moderator.id,
    targetId: target.id,
    reason,
    deleteMessageDays,
    channelId,
    expiresAt: Date.now() + CONFIRMATION_TTL_MS,
  });

  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ban_confirm:${id}`)
      .setLabel('Confirm Ban')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ban_cancel:${id}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );

  return {
    embeds: [banConfirmationEmbed(target, reason)],
    components: [row],
  };
}

export async function handleBanConfirmation(interaction: ButtonInteraction): Promise<boolean> {
  const [action, id] = interaction.customId.split(':');
  if (!id || (action !== 'ban_confirm' && action !== 'ban_cancel')) return false;

  const pending = pendingBans.get(id);
  if (!pending || pending.expiresAt < Date.now()) {
    pendingBans.delete(id);
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(0xdc2626)
          .setTitle('Ban Cancelled')
          .setDescription('This ban confirmation expired.'),
      ],
      components: [],
    });
    return true;
  }

  if (interaction.user.id !== pending.moderatorId) {
    throw new UserInputError('Only the moderator who started this ban can confirm it.');
  }

  pendingBans.delete(id);

  if (action === 'ban_cancel') {
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(0x6b7280)
          .setTitle('Ban Cancelled')
          .setDescription('The user was not banned.'),
      ],
      components: [],
    });
    return true;
  }

  if (!interaction.guild) throw new UserInputError('This action can only be used in a server.');
  const moderator = await interaction.guild.members.fetch(pending.moderatorId);
  const target = await interaction.guild.members.fetch(pending.targetId).catch(() => null);
  if (!target) throw new UserInputError('That user is no longer in the server.');

  const caseId = await banUser(
    moderator,
    target,
    pending.reason,
    pending.deleteMessageDays,
    pending.channelId,
  );

  await interaction.update({
    embeds: [
      publicActionEmbed({
        target: target.user,
        action: 'banned',
        reason: pending.reason,
        caseId,
      }),
    ],
    components: [],
  });
  return true;
}
