/**
 * Status bar formatting
 */

export function formatStatusBar(
  connected: boolean,
  marketName: string,
  outcome: string
): string {
  const status = connected
    ? "{green-fg}● Connected{/green-fg}"
    : "{red-fg}● Disconnected{/red-fg}";

  const maxNameLen = 30;
  const displayName =
    marketName.length > maxNameLen
      ? marketName.substring(0, maxNameLen - 3) + "..."
      : marketName;

  const now = new Date().toLocaleTimeString();

  return `  ${status}  |  {bold}${displayName}{/bold}  |  {cyan-fg}${outcome}{/cyan-fg}  |  {gray-fg}${now}{/gray-fg}  |  {bold}Tab{/bold}=focus  {bold}↑↓{/bold}=scroll  {bold}q{/bold}=quit`;
}

