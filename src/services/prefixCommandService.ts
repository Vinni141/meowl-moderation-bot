import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type GuildMember,
  type GuildTextBasedChannel,
  type Message,
  type MessageCreateOptions,
  type Role,
  type TextChannel,
} from 'discord.js';
import { prisma } from '../database/prisma.js';
import { createBanConfirmation } from './banConfirmationService.js';
import { deleteMessageLater } from '../lib/deleteMessageLater.js';
import { errorToEmbed, UserInputError } from '../lib/errors.js';
import { lockChannel, setSlowmode, unlockChannel } from './channelService.js';
import { compactStatusEmbed, publicActionEmbed } from './embedService.js';
import { jailUser, setupJail, unjailUser } from './jailService.js';
import { kickUser, muteUser, purgeMessages, unbanUser, unmuteUser, warnUser } from './moderationService.js';
import { addRole, removeRole } from './roleService.js';
import { setAfk } from './afkService.js';
import { addTempRole } from './tempRoleService.js';
import { setModLogChannel } from './settingsService.js';
import { ensureModeratorHasPermission } from './permissionService.js';
import { setNickname } from './nicknameService.js';
import { getCommandStates, isCommandEnabled, normalizeCommandName } from './commandSettingsService.js';
import { buildSnipeEmbed } from './snipeService.js';
import { createRemoveWarningComponents } from './warningRemovalService.js';
import { serverEmoji } from './emojiService.js';
import { buildCasesPage } from './casePaginationService.js';
import { isDurationInput } from './durationService.js';

export const PREFIX = ',';

function tokenize(input: string): string[] {
  return input.trim().split(/\s+/).filter(Boolean);
}

function stripMention(token: string): string {
  return token.replace(/[<@#&!>]/g, '');
}

function looksLikeDuration(value: string | undefined): boolean {
  return isDurationInput(value);
}

function looksLikeUserReference(value: string | undefined): boolean {
  if (!value) return false;
  return /^<@!?\d+>$/.test(value) || /^\d{17,20}$/.test(value);
}

async function memberFromToken(message: Message, token: string | undefined): Promise<GuildMember> {
  if (!message.guild || !token) throw new UserInputError('Please mention a user.');
  const id = stripMention(token);
  const member = await message.guild.members.fetch(id).catch(() => null);
  if (!member) throw new UserInputError('That user is not a server member.');
  return member;
}

async function memberFromReply(message: Message): Promise<GuildMember> {
  if (!message.guild || !message.reference?.messageId) throw new UserInputError('Please mention a user or reply to a message.');
  const repliedMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
  const authorId = repliedMessage?.author.id;
  if (!authorId) throw new UserInputError('Could not find the replied user.');
  const member = await message.guild.members.fetch(authorId).catch(() => null);
  if (!member) throw new UserInputError('That user is not a server member.');
  return member;
}

async function parseMuteTargetAndArgs(
  message: Message,
  args: string[],
): Promise<{ target: GuildMember; duration: string | undefined; reasonStart: number }> {
  const hasExplicitTarget = looksLikeUserReference(args[0]);
  const target = hasExplicitTarget ? await memberFromToken(message, args[0]) : await memberFromReply(message);
  const durationIndex = hasExplicitTarget ? 1 : 0;
  const duration = looksLikeDuration(args[durationIndex]) ? args[durationIndex] : undefined;

  return {
    target,
    duration,
    reasonStart: duration ? durationIndex + 1 : durationIndex,
  };
}

async function roleFromToken(message: Message, token: string | undefined): Promise<Role> {
  if (!message.guild || !token) throw new UserInputError('Please mention a role.');
  const id = stripMention(token);
  const roles = await message.guild.roles.fetch();
  const role =
    roles.get(id) ??
    roles.find((candidate) => candidate.name.toLowerCase() === token.toLowerCase());
  if (!role) throw new UserInputError('That role was not found.');
  return role;
}

async function roleFromArgs(message: Message, args: string[], startIndex: number): Promise<{ role: Role; nextIndex: number }> {
  if (!message.guild || !args[startIndex]) throw new UserInputError('Please mention a role or write its name.');
  const roles = await message.guild.roles.fetch();
  const firstToken = args[startIndex];
  const firstId = stripMention(firstToken);
  const mentionedOrIdRole = roles.get(firstId);
  if (mentionedOrIdRole) return { role: mentionedOrIdRole, nextIndex: startIndex + 1 };

  for (let endIndex = args.length; endIndex > startIndex; endIndex -= 1) {
    const candidateName = args.slice(startIndex, endIndex).join(' ').toLowerCase();
    const role = roles.find((candidate) => candidate.name.toLowerCase() === candidateName);
    if (role) return { role, nextIndex: endIndex };
  }

  throw new UserInputError('That role was not found.');
}

async function textChannelFromToken(message: Message, token: string | undefined): Promise<TextChannel> {
  if (!message.guild || !token) throw new UserInputError('Please mention a text channel.');
  const id = stripMention(token);
  const channel = await message.guild.channels.fetch(id).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new UserInputError('That text channel was not found.');
  }
  return channel;
}

function requireModerator(message: Message): GuildMember {
  if (!message.member) throw new UserInputError('This command can only be used in a server.');
  return message.member;
}

function currentTextChannel(message: Message): GuildTextBasedChannel {
  if (!('guildId' in message.channel)) throw new UserInputError('This command can only be used in a server text channel.');
  return message.channel as GuildTextBasedChannel;
}

function reasonFrom(args: string[], start: number, fallback = 'No reason provided'): string {
  return args.slice(start).join(' ').trim() || fallback;
}

async function sendPrefixResponse(message: Message, options: MessageCreateOptions): Promise<Message | null> {
  return message.reply(options).catch((replyError) => {
    console.error('Failed to reply to prefix command:', replyError);
    return currentTextChannel(message).send(options).catch((sendError) => {
      console.error('Failed to send prefix command response:', sendError);
      return null;
    });
  });
}

function checkMarkIcon(message: Message): string {
  return serverEmoji(message.guild, 'check');
}

const INROLE_MEMBERS_PER_PAGE = 40;
const INROLE_MAX_PAGES = 10;

function chunkLines(lines: string[], pageSize: number): string[][] {
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += pageSize) {
    pages.push(lines.slice(index, index + pageSize));
  }
  return pages;
}

async function inRoleEmbeds(message: Message, role: Role): Promise<EmbedBuilder[]> {
  if (!message.guild) throw new UserInputError('This command can only be used in a server.');

  const members = await message.guild.members.fetch();
  const matchingMembers = [...members.values()]
    .filter((member) => member.roles.cache.has(role.id))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  const allLines = matchingMembers.map((member, index) => `${index + 1}. ${member} (${member.user.tag})`);
  const visibleLines = allLines.slice(0, INROLE_MEMBERS_PER_PAGE * INROLE_MAX_PAGES);
  const pages = visibleLines.length ? chunkLines(visibleLines, INROLE_MEMBERS_PER_PAGE) : [[]];
  const truncated = allLines.length > visibleLines.length;

  return pages.map((lines, index) => {
    const pageText = pages.length > 1 ? ` - Page ${index + 1}/${pages.length}` : '';
    const shownText = truncated ? ` - showing first ${visibleLines.length}` : '';

    return new EmbedBuilder()
      .setColor(role.color || 0x38bdf8)
      .setTitle(`Members in ${role.name}`)
      .setDescription(lines.length ? lines.join('\n') : 'No members found with this role.')
      .setFooter({ text: `${matchingMembers.length} member(s) found${shownText}${pageText}` });
  });
}

async function warningsEmbed(message: Message, moderator: GuildMember, target: GuildMember): Promise<MessageCreateOptions> {
  ensureModeratorHasPermission(moderator, PermissionFlagsBits.ModerateMembers);
  const now = new Date();

  await prisma.warning.updateMany({
    where: {
      guildId: target.guild.id,
      userId: target.id,
      active: true,
      expiresAt: { lte: now },
    },
    data: { active: false },
  });

  const warnings = await prisma.warning.findMany({
    where: {
      guildId: target.guild.id,
      userId: target.id,
      active: true,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const warningIcon = serverEmoji(message.guild, 'warn');
  const countLabel = `${warnings.length} warn${warnings.length === 1 ? '' : 's'} found`;
  const warningLines = warnings.length
    ? warnings
        .map((warning, index) => {
          const moderatorLabel = warning.moderatorId ? `<@${warning.moderatorId}>` : 'Unknown moderator';
          return `> **${index + 1}. ${moderatorLabel}:**\n> ${warning.reason}`;
        })
        .join('\n')
    : '> No active warnings.';

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setAuthor({
      name: `@${target.user.username}`,
      iconURL: target.user.displayAvatarURL(),
    })
    .setDescription(`${warningIcon} **${countLabel}**\n\n${warningLines}`);

  return {
    embeds: [embed],
    components: createRemoveWarningComponents(target.id, warnings.length === 0),
  };
}

async function listCommandsEmbed(message: Message): Promise<EmbedBuilder> {
  if (!message.guild) throw new UserInputError('This command can only be used in a server.');
  const states = await getCommandStates(message.guild.id);
  const enabledByName = new Map(states.map((state) => [state.name, state.enabled]));
  const mark = (name: string) => (enabledByName.get(name) === false ? 'disabled' : 'enabled');

  const groups: Array<[string, string[]]> = [
    ['Moderation', ['warn', 'warns', 'cases', 'mute', 'unmute', 'kick', 'ban', 'unban', 'purge', 's']],
    ['Jail', ['jailsetup', 'jail', 'unjail']],
    ['Roles', ['roleadd', 'roleremove', 'temproleadd', 'inrole']],
    ['Channel Tools', ['slowmode', 'lock', 'unlock']],
    ['Utility / Config', ['afk', 'modlog', 'nickname', 'listcommands']],
  ];

  return new EmbedBuilder()
    .setColor(0x38bdf8)
    .setTitle('Available Commands')
    .setDescription(
      groups
        .map(([groupName, commands]) => {
          const commandList = commands.map((name) => `\`,${name}\` - ${mark(name)}`).join('\n');
          return `**${groupName}**\n${commandList}`;
        })
        .join('\n\n'),
    );
}

async function executePrefixCommand(message: Message, commandName: string, args: string[]): Promise<EmbedBuilder | null> {
  const moderator = requireModerator(message);
  const icon = checkMarkIcon(message);

  switch (commandName) {
    case 'warn': {
      const target = await memberFromToken(message, args[0]);
      const reason = reasonFrom(args, 1);
      const caseId = await warnUser(moderator, target, reason, message.channel.id);
      return publicActionEmbed({ icon, target: target.user, action: 'warned', reason, duration: '30 days', caseId });
    }
    case 'warns': {
      await sendPrefixResponse(message, await warningsEmbed(message, moderator, await memberFromToken(message, args[0])));
      return null;
    }
    case 'cases': {
      await sendPrefixResponse(message, await buildCasesPage(moderator, await memberFromToken(message, args[0])));
      return null;
    }
    case 'listcommands': {
      return listCommandsEmbed(message);
    }
    case 's': {
      const amount = args[0] === undefined ? 1 : Number(args[0]);
      return buildSnipeEmbed(message, amount).embeds[0] ?? null;
    }
    case 'mute': {
      const { target, duration, reasonStart } = await parseMuteTargetAndArgs(message, args);
      const reason = reasonFrom(args, reasonStart);
      const caseId = await muteUser(moderator, target, duration, reason, message.channel.id);
      return publicActionEmbed({ icon, target: target.user, action: 'muted', reason, duration: duration ?? 'Permanent', caseId });
    }
    case 'unmute': {
      const target = await memberFromToken(message, args[0]);
      const reason = reasonFrom(args, 1, 'Unmute');
      const caseId = await unmuteUser(moderator, target, reason, message.channel.id);
      return publicActionEmbed({ icon, target: target.user, action: 'unmuted', reason, caseId });
    }
    case 'kick': {
      const target = await memberFromToken(message, args[0]);
      const reason = reasonFrom(args, 1);
      const caseId = await kickUser(moderator, target, reason, message.channel.id);
      return publicActionEmbed({ icon, target: target.user, action: 'kicked', reason, caseId });
    }
    case 'ban': {
      ensureModeratorHasPermission(moderator, PermissionFlagsBits.BanMembers);
      const maybeDays = Number(args[1]);
      const hasDays = Number.isInteger(maybeDays) && args[1] !== undefined;
      const target = await memberFromToken(message, args[0]);
      const reason = reasonFrom(args, hasDays ? 2 : 1);
      const prompt = await sendPrefixResponse(
        message,
        createBanConfirmation(moderator, target, reason, hasDays ? maybeDays : 0, message.channel.id),
      );
      if (prompt) deleteMessageLater(prompt, 60_000);
      return null;
    }
    case 'unban': {
      const userId = args[0] ? stripMention(args[0]) : undefined;
      if (!userId) throw new UserInputError('Usage: ,unban user_id reason');
      const reason = reasonFrom(args, 1, 'No reason provided');
      const caseId = await unbanUser(moderator.guild, moderator, userId, reason, message.channel.id);
      return publicActionEmbed({ icon, action: 'unbanned a user', reason, caseId, details: userId });
    }
    case 'jail': {
      const duration = looksLikeDuration(args[1]) ? args[1] : undefined;
      const target = await memberFromToken(message, args[0]);
      const reason = reasonFrom(args, duration ? 2 : 1);
      const result = await jailUser(
        moderator,
        target,
        reason,
        duration,
      );
      return publicActionEmbed({ icon, target: target.user, action: 'jailed', reason, duration, caseId: result.caseId });
    }
    case 'unjail': {
      const target = await memberFromToken(message, args[0]);
      const reason = reasonFrom(args, 1, 'Unjail');
      const result = await unjailUser(
        moderator.guild,
        target,
        moderator.id,
        reason,
      );
      return publicActionEmbed({ icon, target: target.user, action: 'unjailed', reason, caseId: result.caseId });
    }
    case 'jailsetup': {
      const result = await setupJail(moderator, await roleFromToken(message, args[0]), await textChannelFromToken(message, args[1]));
      return publicActionEmbed({
        icon,
        action: 'configured jail',
        caseId: result.caseId,
        details: `${result.updatedChannels} channels updated`,
      });
    }
    case 'modlog': {
      const channel = await textChannelFromToken(message, args[0]);
      const caseId = await setModLogChannel(moderator, channel);
      return publicActionEmbed({ icon, action: 'set the moderation log channel', caseId, details: `${channel}` });
    }
    case 'nickname':
    case 'nick': {
      const target = await memberFromToken(message, args[0]);
      const rawNickname = args.slice(1).join(' ').trim();
      if (!rawNickname) throw new UserInputError('Usage: ,nickname @user new nickname');
      const nickname = rawNickname.toLowerCase() === 'reset' ? null : rawNickname;
      const caseId = await setNickname(moderator, target, nickname, 'Nickname command');
      return publicActionEmbed({
        icon,
        target: target.user,
        action: nickname ? 'had their nickname changed' : 'had their nickname reset',
        caseId,
        details: nickname ?? 'Reset',
      });
    }
    case 'afk': {
      const reason = reasonFrom(args, 0, 'AFK');
      await setAfk(moderator, reason);
      return compactStatusEmbed(`${serverEmoji(message.guild, 'check')} ${moderator}: You're now AFK with the status: **${reason}**`);
    }
    case 'roleadd': {
      const target = await memberFromToken(message, args[0]);
      const { role, nextIndex } = await roleFromArgs(message, args, 1);
      const reason = reasonFrom(args, nextIndex, 'No reason provided');
      const caseId = await addRole(moderator, target, role, reason);
      return publicActionEmbed({ icon, target: target.user, action: 'received a role', reason, caseId, details: role.name });
    }
    case 'roleremove': {
      const target = await memberFromToken(message, args[0]);
      const { role, nextIndex } = await roleFromArgs(message, args, 1);
      const reason = reasonFrom(args, nextIndex, 'No reason provided');
      const caseId = await removeRole(moderator, target, role, reason);
      return publicActionEmbed({ icon, target: target.user, action: 'lost a role', reason, caseId, details: role.name });
    }
    case 'temproleadd': {
      if (!args[2]) throw new UserInputError('Usage: ,temproleadd @user @role 7d reason');
      const target = await memberFromToken(message, args[0]);
      const { role, nextIndex } = await roleFromArgs(message, args, 1);
      const duration = args[nextIndex];
      if (!duration) throw new UserInputError('Usage: ,temproleadd @user role 7d reason');
      const reason = reasonFrom(args, nextIndex + 1, 'No reason provided');
      const caseId = await addTempRole(
        moderator,
        target,
        role,
        duration,
        reason,
      );
      return publicActionEmbed({ icon, target: target.user, action: 'received a temporary role', reason, duration, caseId, details: role.name });
    }
    case 'inrole': {
      const { role } = await roleFromArgs(message, args, 0);
      await sendPrefixResponse(message, { embeds: await inRoleEmbeds(message, role) });
      return null;
    }
    case 'purge': {
      const amount = Number(args[0]);
      if (!Number.isInteger(amount)) throw new UserInputError('Usage: ,purge 20 [@user] [reason]');
      const possibleUser = args[1]?.startsWith('<@') ? stripMention(args[1]) : undefined;
      const result = await purgeMessages(
        moderator,
        currentTextChannel(message),
        amount,
        reasonFrom(args, possibleUser ? 2 : 1, 'No reason provided'),
        possibleUser,
        message.id,
      );
      const skipped = result.skippedOld ? ` (${result.skippedOld} older than 14 days skipped)` : '';
      return publicActionEmbed({ icon, action: 'purged messages', caseId: result.caseId, details: `${result.deleted} messages deleted${skipped}` });
    }
    case 'slowmode': {
      const seconds = Number(args[0]);
      if (!Number.isInteger(seconds)) throw new UserInputError('Usage: ,slowmode 5 reason');
      const reason = reasonFrom(args, 1, 'No reason provided');
      const caseId = await setSlowmode(moderator, currentTextChannel(message), seconds, reason);
      return publicActionEmbed({ icon, action: 'updated slowmode', reason, duration: `${seconds}s`, caseId });
    }
    case 'lock': {
      const hasChannel = args[0]?.startsWith('<#');
      const channel = hasChannel ? await textChannelFromToken(message, args[0]) : currentTextChannel(message);
      const reason = reasonFrom(args, hasChannel ? 1 : 0, 'No reason provided');
      const caseId = await lockChannel(moderator, channel, reason);
      return publicActionEmbed({ icon, action: 'locked a channel', reason, caseId, details: `${channel}` });
    }
    case 'unlock': {
      const hasChannel = args[0]?.startsWith('<#');
      const channel = hasChannel ? await textChannelFromToken(message, args[0]) : currentTextChannel(message);
      const reason = reasonFrom(args, hasChannel ? 1 : 0, 'No reason provided');
      const caseId = await unlockChannel(moderator, channel, reason);
      return publicActionEmbed({ icon, action: 'unlocked a channel', reason, caseId, details: `${channel}` });
    }
    default:
      throw new UserInputError(`Unknown command. Use slash commands or prefix commands like ,warn, ,mute, ,kick, ,ban.`);
  }
}

export async function handlePrefixCommand(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot || !message.content.startsWith(PREFIX)) return false;
  const [rawName, ...args] = tokenize(message.content.slice(PREFIX.length));
  if (!rawName) return false;
  const commandName = rawName.toLowerCase();
  const normalizedCommandName = normalizeCommandName(commandName);
  if (!(await isCommandEnabled(message.guild.id, normalizedCommandName))) {
    const reply = await sendPrefixResponse(message, {
      embeds: [errorToEmbed(new UserInputError('This command is currently disabled.'))],
    });
    if (reply) deleteMessageLater(reply);
    return true;
  }
  const shouldAutoDelete =
    commandName !== 'afk' &&
    commandName !== 'warns' &&
    commandName !== 'cases' &&
    commandName !== 'listcommands' &&
    commandName !== 's';
  if (shouldAutoDelete) deleteMessageLater(message);

  try {
    const embed = await executePrefixCommand(message, commandName, args);
    if (!embed) return true;
    const reply = await sendPrefixResponse(message, { embeds: [embed] });
    if (reply && shouldAutoDelete) deleteMessageLater(reply);
  } catch (error) {
    const reply = await sendPrefixResponse(message, { embeds: [errorToEmbed(error)] });
    if (reply && shouldAutoDelete) deleteMessageLater(reply);
  }

  return true;
}
