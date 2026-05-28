import {
  ChannelType,
  type ChatInputCommandInteraction,
  type GuildMember,
  type GuildTextBasedChannel,
  type Role,
  type TextChannel,
} from 'discord.js';
import { UserInputError } from '../lib/errors.js';

export function requireGuildMember(interaction: ChatInputCommandInteraction): GuildMember {
  if (!interaction.inGuild() || !interaction.member || !('roles' in interaction.member)) {
    throw new UserInputError('This command can only be used in a server.');
  }
  return interaction.member as GuildMember;
}

export async function getTargetMember(interaction: ChatInputCommandInteraction, name = 'user'): Promise<GuildMember> {
  const user = interaction.options.getUser(name, true);
  const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
  if (!member) throw new UserInputError('That user is not a server member.');
  return member;
}

export function currentGuildTextChannel(interaction: ChatInputCommandInteraction): GuildTextBasedChannel {
  const channel = interaction.channel;
  if (!channel || !('guildId' in channel)) throw new UserInputError('This command needs a server text channel.');
  return channel as GuildTextBasedChannel;
}

export function requireTextChannel(interaction: ChatInputCommandInteraction, name: string): TextChannel {
  const channel = interaction.options.getChannel(name, true, [ChannelType.GuildText]);
  return channel as TextChannel;
}

export function requireRole(interaction: ChatInputCommandInteraction, name = 'role'): Role {
  return interaction.options.getRole(name, true) as Role;
}
