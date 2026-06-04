import type { Message } from 'discord.js';
import { deleteMessageLater } from '../lib/deleteMessageLater.js';
import { clearAfk, formatAfkDuration, getAfk } from '../services/afkService.js';
import { compactStatusEmbed } from '../services/embedService.js';
import { serverEmoji } from '../services/emojiService.js';
import { handlePrefixCommand } from '../services/prefixCommandService.js';
import { applyServerTagRoleToMember } from '../services/statusRoleService.js';

export async function handleMessageCreate(message: Message): Promise<void> {
  if (!message.guild || message.author.bot) return;
  if (await handlePrefixCommand(message)) return;

  const member = message.member;
  if (member) {
    await applyServerTagRoleToMember(member);
    const cleared = await clearAfk(member);
    if (cleared) {
      const reply = await message
        .reply({
          embeds: [
            compactStatusEmbed(
              `${serverEmoji(message.guild, 'check')} ${member}: Welcome back, you were away for **${formatAfkDuration(cleared.createdAt)}**`,
            ),
          ],
        })
        .catch(() => null);
      if (reply) deleteMessageLater(reply);
    }
  }

  for (const user of message.mentions.users.values()) {
    if (user.bot || user.id === message.author.id) continue;
    const afk = await getAfk(message.guild.id, user.id);
    if (afk) {
      const reply = await message
        .reply({
          embeds: [
            compactStatusEmbed(
              `${serverEmoji(message.guild, 'questionMark')} <@${user.id}> is AFK: **${afk.reason ?? 'AFK'}** - ${formatAfkDuration(afk.createdAt)} ago`,
            ),
          ],
        })
        .catch(() => null);
      if (reply) deleteMessageLater(reply);
      break;
    }
  }
}
