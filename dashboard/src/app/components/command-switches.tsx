'use client';

import { useMemo, useState } from 'react';
import type { ConfigurableCommand } from '../../lib/commands';

type CommandSwitchesProps = {
  commands: readonly ConfigurableCommand[];
  disabledCommands: string[];
  guildId: string;
};

export function CommandSwitches({ commands, disabledCommands, guildId }: CommandSwitchesProps) {
  const initialStates = useMemo(
    () => Object.fromEntries(commands.map((command) => [command, !disabledCommands.includes(command)])),
    [commands, disabledCommands],
  ) as Record<ConfigurableCommand, boolean>;
  const [enabledByCommand, setEnabledByCommand] = useState(initialStates);
  const [pendingCommand, setPendingCommand] = useState<ConfigurableCommand | null>(null);

  function toggleCommand(command: ConfigurableCommand) {
    const previousValue = enabledByCommand[command];
    const nextValue = !previousValue;

    setPendingCommand(command);
    setEnabledByCommand((current) => ({ ...current, [command]: nextValue }));

    void fetch('/api/commands/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, enabled: nextValue, guildId }),
    })
      .then((response) => {
        if (!response.ok) {
          setEnabledByCommand((current) => ({ ...current, [command]: previousValue }));
        }
      })
      .catch(() => {
        setEnabledByCommand((current) => ({ ...current, [command]: previousValue }));
      })
      .finally(() => setPendingCommand(null));
  }

  return (
    <div className="command-grid">
      {commands.map((command) => {
        const enabled = enabledByCommand[command];
        const pending = pendingCommand === command;

        return (
          <div className="command-row" key={command}>
            <div>
              <strong>,{command}</strong>
              <span>{enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <button
              aria-checked={enabled}
              aria-label={`${enabled ? 'Disable' : 'Enable'} ,${command}`}
              className="switch"
              data-pending={pending ? 'true' : 'false'}
              data-state={enabled ? 'on' : 'off'}
              disabled={pending}
              onClick={() => toggleCommand(command)}
              role="switch"
              type="button"
            >
              <span className="switch-track">
                <span className="switch-thumb" />
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
