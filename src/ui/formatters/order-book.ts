/**
 * Order book formatting
 */

import { OrderBook } from "../../types";

const MAX_LEVELS = 30;

export function formatOrderBook(orderBook: OrderBook): string {
  if (orderBook.bids.length === 0 && orderBook.asks.length === 0) {
    return "\n  {gray-fg}Waiting for order book...{/gray-fg}";
  }

  const sortedAsks = [...orderBook.asks].sort((a, b) => a.price - b.price);
  const sortedBids = [...orderBook.bids].sort((a, b) => b.price - a.price);

  const header = buildOrderBookHeader();
  const rows = buildOrderBookRows(sortedAsks, sortedBids);
  const spread = calculateSpread(sortedAsks, sortedBids);

  return header + rows.join("\n") + spread;
}

function buildOrderBookHeader(): string {
  return (
    "  {bold}       Price      Size    |       Price      Size{/bold}\n" +
    "  {bold}       (Ask)              |       (Bid)             {/bold}\n" +
    "  ──────────────────────────────────────────────────────────\n"
  );
}

function buildOrderBookRows(
  sortedAsks: Array<{ price: number; size: number }>,
  sortedBids: Array<{ price: number; size: number }>
): string[] {
  const numRows = Math.max(
    Math.min(sortedAsks.length, MAX_LEVELS),
    Math.min(sortedBids.length, MAX_LEVELS)
  );

  const rows: string[] = [];

  for (let i = 0; i < numRows; i++) {
    const ask = i < sortedAsks.length ? sortedAsks[i] : null;
    const bid = i < sortedBids.length ? sortedBids[i] : null;

    const askPrice = ask ? ask.price.toFixed(4).padStart(10) : "          ";
    const askSize = ask ? ask.size.toFixed(2).padStart(9) : "         ";

    const bidPrice = bid ? bid.price.toFixed(4).padStart(10) : "          ";
    const bidSize = bid ? bid.size.toFixed(2).padStart(9) : "         ";

    rows.push(
      `  {red-fg}${askPrice}  ${askSize}{/red-fg}  |  {green-fg}${bidPrice}  ${bidSize}{/green-fg}`
    );
  }

  return rows;
}

function calculateSpread(
  sortedAsks: Array<{ price: number; size: number }>,
  sortedBids: Array<{ price: number; size: number }>
): string {
  if (sortedAsks.length === 0 || sortedBids.length === 0) {
    return "";
  }

  const bestAsk = sortedAsks[0].price;
  const bestBid = sortedBids[0].price;
  const spread = bestAsk - bestBid;
  const spreadBps = ((spread / bestBid) * 10000).toFixed(2);

  return `\n  ──────────────────────────────────────────────────────────\n  Spread: {cyan-fg}${spread.toFixed(
    4
  )} (${spreadBps} bps){/cyan-fg}`;
}

