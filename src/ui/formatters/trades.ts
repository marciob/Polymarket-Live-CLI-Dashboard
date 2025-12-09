/**
 * Trades formatting
 */

import { Trade } from "../../types";

export interface DisplayTrade extends Trade {
  isSimulated?: boolean;
}

export function formatMarketTrades(trades: DisplayTrade[]): string {
  if (trades.length === 0) {
    return formatEmptyTrades();
  }

  const header = buildTradesHeader();
  const rows = trades.slice(0, 50).map(formatTradeRow);

  return header + rows.join("\n");
}

function formatEmptyTrades(): string {
  const now = new Date().toLocaleTimeString();
  return `\n  {gray-fg}Waiting for trades... (${now}){/gray-fg}\n\n  {yellow-fg}💡 Tip: Trades appear when orders match. The order book\n     updates frequently, but trades may be less common.{/yellow-fg}\n\n  {cyan-fg}Try a high-volume market for more activity:{/cyan-fg}\n  {gray-fg}npm run find-tokens{/gray-fg}`;
}

function buildTradesHeader(): string {
  return (
    "  {bold}Time          Side    Price      Size        Value (USDC){/bold}\n" +
    "  ───────────────────────────────────────────────────────────────\n"
  );
}

function formatTradeRow(trade: DisplayTrade): string {
  const time = new Date(trade.timestamp).toLocaleTimeString();
  const prefix = trade.isSimulated ? "{magenta-fg}S-{/magenta-fg}" : "   ";
  const side =
    trade.side === "BUY"
      ? "{green-fg}BUY {/green-fg}"
      : "{red-fg}SELL{/red-fg}";
  const price = trade.price.toFixed(4).padStart(8);
  const size = trade.size.toFixed(2).padStart(10);
  const notional = trade.notional.toFixed(2).padStart(12);

  return `  ${time}  ${prefix}${side}  ${price}  ${size}  ${notional}`;
}

