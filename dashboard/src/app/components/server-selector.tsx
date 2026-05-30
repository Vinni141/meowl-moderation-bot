'use client';

import { useRouter } from 'next/navigation';
import type { SessionGuild } from '../../lib/auth';

type ServerSelectorProps = {
  guilds: SessionGuild[];
  selectedGuildId: string;
};

export function ServerSelector({ guilds, selectedGuildId }: ServerSelectorProps) {
  const router = useRouter();

  return (
    <label className="server-select">
      <span>Server</span>
      <select value={selectedGuildId} onChange={(event) => router.push(`/?guildId=${event.target.value}`)}>
        {guilds.map((guild) => (
          <option key={guild.id} value={guild.id}>
            {guild.name}
          </option>
        ))}
      </select>
    </label>
  );
}
