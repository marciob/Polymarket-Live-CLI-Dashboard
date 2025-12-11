// src/ui/formatters/portfolio.ts
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
    "  Portfolio Summary\n" +
    "  ──────────────────────────────────────────────────────────────────────\n\n"
  );
}

function buildPortfolioSummary(portfolio: PortfolioSnapshot): string {
  const aggregatedPositions = aggregatePositionsByOutcome(portfolio.positions);

  // Calculate total cost from aggregated positions
  const positionsTotalCost = aggregatedPositions.reduce(
    (sum, pos) => sum + pos.totalCost,
    0
  );
  const displayTotalCost =
    portfolio.positions.length > 0 ? positionsTotalCost : portfolio.totalCost;

  const correctUnrealizedPnL = portfolio.currentValue - displayTotalCost;
  const realizedPnL = portfolio.realizedPnL;
  const totalPnL = correctUnrealizedPnL + realizedPnL;
  const pnlPercent =
    displayTotalCost > 0
      ? ((totalPnL / displayTotalCost) * 100).toFixed(2)
      : "0.00";

  // Keep portfolio panel free of blessed tags to avoid tag-parser rendering bugs.
  const fmt = (n: number): string => {
    const num = Number(n);
    if (!isFinite(num) || isNaN(num)) {
      return "0.00";
    }
    return num.toFixed(2);
  };

  // Build summary with extensive right-padding to wipe stale characters in TUI
  const pad = (s: string) => s.padEnd(60, " ");
  let summary = "";
  // Add a blank line at the top to prevent "first-line" rendering bugs in blessed
  // which were causing decimal points to be eaten or text to be corrupted.
  summary += `${pad("")}\n`;

  summary += `${pad(`  Total Cost:       ${fmt(displayTotalCost)} USDC`)}\n`;
  summary += `${pad(
    `  Current Value:    ${fmt(portfolio.currentValue)} USDC`
  )}\n`;
  summary += `${pad(
    `  Unrealized P&L:   ${fmt(correctUnrealizedPnL)} USDC`
  )}\n`;
  summary += `${pad(`  Realized P&L:     ${fmt(realizedPnL)} USDC`)}\n`;
  summary += `${pad(
    `  Total P&L:        ${fmt(totalPnL)} USDC (${pnlPercent}%)`
  )}\n\n`;

  return summary;
}

function buildPositionsList(portfolio: PortfolioSnapshot): string {
  if (portfolio.positions.length === 0) {
    return "  No positions yet...\n";
  }

  const aggregatedPositions = aggregatePositionsByOutcome(portfolio.positions);

  let positions =
    "  Positions:\n" +
    "  ──────────────────────────────────────────────────────────────────────\n";
  positions +=
    "  Outcome        Shares      Avg Price    Cost        Value       P&L\n";
  positions +=
    "  ──────────────────────────────────────────────────────────────────────\n";

  const totalShares = aggregatedPositions.reduce((sum, p) => sum + p.shares, 0);

  for (const position of aggregatedPositions) {
    const outcomeCurrentValue =
      totalShares > 0
        ? (position.shares / totalShares) * portfolio.currentValue
        : 0;
    const outcomeCurrentPrice =
      position.shares > 0 ? outcomeCurrentValue / position.shares : 0.5;

    positions += formatPositionRow(position, outcomeCurrentPrice);
  }

  return positions;
}

function aggregatePositionsByOutcome(
  positions: Array<{
    outcome: string;
    shares: number;
    averagePrice: number;
    totalCost: number;
  }>
): Array<{
  outcome: string;
  shares: number;
  averagePrice: number;
  totalCost: number;
}> {
  const outcomeMap = new Map<string, { shares: number; totalCost: number }>();

  for (const position of positions) {
    const outcome = position.outcome;
    const existing = outcomeMap.get(outcome);

    if (existing) {
      existing.shares += position.shares;
      existing.totalCost += position.totalCost;
    } else {
      outcomeMap.set(outcome, {
        shares: position.shares,
        totalCost: position.totalCost,
      });
    }
  }

  const aggregated: Array<{
    outcome: string;
    shares: number;
    averagePrice: number;
    totalCost: number;
  }> = [];

  for (const [outcome, aggregatedData] of outcomeMap.entries()) {
    const averagePrice =
      aggregatedData.shares > 0
        ? aggregatedData.totalCost / aggregatedData.shares
        : 0;

    aggregated.push({
      outcome,
      shares: aggregatedData.shares,
      averagePrice,
      totalCost: aggregatedData.totalCost,
    });
  }

  return aggregated.sort((a, b) => a.outcome.localeCompare(b.outcome));
}

function formatPositionRow(
  position: {
    outcome: string;
    shares: number;
    averagePrice: number;
    totalCost: number;
  },
  currentPrice: number
): string {
  const positionValue = currentPrice * position.shares;
  const positionPnL = positionValue - position.totalCost;

  const outcome = position.outcome.substring(0, 12).padEnd(12);
  const shares = position.shares.toFixed(2).padStart(10);
  const avgPrice = position.averagePrice.toFixed(4).padStart(10);
  const cost = position.totalCost.toFixed(2).padStart(10);
  const value = positionValue.toFixed(2).padStart(10);
  const pnl = `${positionPnL >= 0 ? "+" : ""}${positionPnL.toFixed(
    2
  )}`.padStart(10);

  return `  ${outcome}  ${shares}  ${avgPrice}  ${cost}  ${value}  ${pnl}\n`;
}
