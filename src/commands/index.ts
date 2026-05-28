import { banCommand } from './moderation/ban.js';
import { jailCommand } from './moderation/jail.js';
import { jailsetupCommand } from './moderation/jailsetup.js';
import { kickCommand } from './moderation/kick.js';
import { muteCommand } from './moderation/mute.js';
import { purgeCommand } from './moderation/purge.js';
import { unbanCommand } from './moderation/unban.js';
import { unjailCommand } from './moderation/unjail.js';
import { warnCommand } from './moderation/warn.js';
import { lockCommand } from './config/lock.js';
import { modlogCommand } from './config/modlog.js';
import { slowmodeCommand } from './config/slowmode.js';
import { unlockCommand } from './config/unlock.js';
import { afkCommand } from './utility/afk.js';
import { roleaddCommand } from './utility/roleadd.js';
import { roleremoveCommand } from './utility/roleremove.js';
import { temproleaddCommand } from './utility/temproleadd.js';
import type { SlashCommand } from '../types/command.js';

export const commands: SlashCommand[] = [
  warnCommand,
  muteCommand,
  kickCommand,
  banCommand,
  unbanCommand,
  jailsetupCommand,
  jailCommand,
  unjailCommand,
  afkCommand,
  roleaddCommand,
  roleremoveCommand,
  temproleaddCommand,
  purgeCommand,
  modlogCommand,
  slowmodeCommand,
  lockCommand,
  unlockCommand,
];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
