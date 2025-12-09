/**
 * Portfolio formatting
 */

import { PortfolioSnapshot } from "../../portfolio/types";

export function formatPortfolio(portfolio: PortfolioSnapshot): string {
  const header = buildPortfolioHeader();
  const summary = buildPortfolioSummary(portfolio);
  const positions = buildPositionsList(portfolio);

  return header + summary + positions;
}

function buildPortfolioHeader(): string {
  return (
    "  {bold}Portfolio Summary{/bold}\n" +
    "  ──────────────────────────────────────────────────────────────────────\n\n"
  );
}

function buildPortfolioSummary(portfolio: PortfolioSnapshot): string {
  const totalCost = portfolio.totalCost.toFixed(2);
  const currentValue = portfolio.currentValue.toFixed(2);
  const unrealizedPnL = portfolio.unrealizedPnL;
  const realizedPnL = portfolio.realizedPnL;
  const totalPnL = unrealizedPnL + realizedPnL;
  const pnlColor = totalPnL >= 0 ? "green" : "red";
  const pnlPercent =
    portfolio.totalCost > 0
      ? ((totalPnL / portfolio.totalCost) * 100).toFixed(2)
      : "0.00";

  let summary = `  {bold}Total Cost:        {/bold}${totalCost.padStart(15)} USDC\n`;
  summary += `  {bold}Current Value:     {/bold}${currentValue.padStart(15)} USDC\n`;
  summary += `  {bold}Unrealized P&L:    {/bold}{${pnlColor}-fg}${unrealizedPnL.toFixed(2).padStart(15)}{/} USDC\n`;
  summary += `  {bold}Realized P&L:      {/bold}{${pnlColor}-fg}${realizedPnL.toFixed(2).padStart(15)}{/} USDC\n`;
  summary += `  {bold}Total P&L:         {/bold}{${pnlColor}-fg}${totalPnL.toFixed(2).padStart(15)} USDC (${pnlPercent}%){/}\n\n`;

  return summary;
}

function buildPositionsList(portfolio: PortfolioSnapshot): string {
  if (portfolio.positions.length === 0) {
    return "  {gray-fg}No positions yet...{/gray-fg}\n";
  }

  let positions =
    "  {bold}Positions:{/bold}\n" +
    "  ──────────────────────────────────────────────────────────────────────\n";
  positions +=
    "  {bold}Outcome        Shares      Avg Price    Cost        Value       P&L{/bold}\n";
  positions +=
    "  ──────────────────────────────────────────────────────────────────────\n";

  const totalShares = portfolio.positions.reduce(
    (sum, p) => sum + p.shares,
    0
  );
  const currentPrice =
    totalShares > 0 ? portfolio.currentValue / totalShares : 0.5;

  for (const position of portfolio.positions) {
    positions += formatPositionRow(position, currentPrice);
  }

  return positions;
}

function formatPositionRow(
  position: { outcome: string; shares: number; averagePrice: number; totalCost: number },
  currentPrice: number
): string {
  const positionValue = currentPrice * position.shares;
  const positionPnL = positionValue - position.totalCost;
  const pnlColor = positionPnL >= 0 ? "green" : "red";

  const outcome = position.outcome.substring(0, 12).padEnd(12);
  const shares = position.shares.toFixed(2).padStart(10);
  const avgPrice = position.averagePrice.toFixed(4).padStart(10);
  const cost = position.totalCost.toFixed(2).padStart(10);
  const value = positionValue.toFixed(2).padStart(10);
  const pnl = `${positionPnL >= 0 ? "+" : ""}${positionPnL.toFixed(2)}`.padStart(
    10
  );

  return `  ${outcome}  ${shares}  ${avgPrice}  ${cost}  ${value}  {${pnlColor}-fg}${pnl}{/}\n`;
}

