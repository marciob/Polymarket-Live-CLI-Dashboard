// src/ui/formatters/simulated-trades.ts
/**
 * Simulated trades formatting
 */

import { SimulatedTrade } from "../../strategy/types";

export function formatSimulatedTrades(trades: SimulatedTrade[]): string {
  if (trades.length === 0) {
    return formatEmptySimulatedTrades();
  }

  const header = buildSimulatedTradesHeader();
  const rows = trades.slice(0, 30).map(formatSimulatedTradeRow);

  return header + rows.join("\n");
}

function formatEmptySimulatedTrades(): string {
  return "\n  {gray-fg}No simulated trades yet...{/gray-fg}\n\n  {yellow-fg}💡 Simulated trades will appear here when your\n     strategy executes.{/yellow-fg}";
}

function buildSimulatedTradesHeader(): string {
  return (
    "  {bold}Time          Strategy      Side    Price      Size        Value{/bold}\n" +
    "  ──────────────────────────────────────────────────────────────────────\n"
  );
}

function formatSimulatedTradeRow(trade: SimulatedTrade): string {
  const time = new Date(trade.timestamp).toLocaleTimeString();
  const strategy = trade.strategyName.substring(0, 12).padEnd(12);
  const side =
    trade.side === "BUY"
      ? "{green-fg}BUY {/green-fg}"
      : "{red-fg}SELL{/red-fg}";
  const price = trade.price.toFixed(4).padStart(8);
  const size = trade.size.toFixed(2).padStart(10);
  const notional = trade.notional.toFixed(2).padStart(12);

  return `  ${time}  ${strategy}  ${side}  ${price}  ${size}  ${notional}`;
}
