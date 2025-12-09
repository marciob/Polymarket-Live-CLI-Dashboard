/**
 * Portfolio tracker for simulated positions
 */

import { Position, Portfolio, PortfolioSnapshot } from "./types";
import { OrderBook } from "../types";

export class PortfolioTracker {
  private portfolio: Portfolio;
  private currentPrices: Map<string, number> = new Map(); // tokenId -> current price

  constructor() {
    this.portfolio = {
      positions: new Map(),
      totalCost: 0,
      currentValue: 0,
      unrealizedPnL: 0,
      realizedPnL: 0,
    };
  }

  /**
   * Update current market prices from order book
   */
  updatePrices(tokenId: string, orderBook: OrderBook): void {
    // Use midpoint price if available, otherwise best bid/ask
    let price = 0.5; // Default midpoint

    if (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
      const bestBid = orderBook.bids[0]?.price || 0;
      const bestAsk = orderBook.asks[0]?.price || 1;
      price = (bestBid + bestAsk) / 2;
    } else if (orderBook.asks.length > 0) {
      price = orderBook.asks[0].price;
    } else if (orderBook.bids.length > 0) {
      price = orderBook.bids[0].price;
    }

    this.currentPrices.set(tokenId, price);
    this.recalculateValue();
  }

  /**
   * Set price directly (useful when you have a specific price)
   */
  setPrice(tokenId: string, price: number): void {
    this.currentPrices.set(tokenId, price);
    this.recalculateValue();
  }

  /**
   * Add a simulated trade to the portfolio
   */
  addTrade(
    tokenId: string,
    outcome: string,
    side: "BUY" | "SELL",
    price: number,
    size: number,
    timestamp: number
  ): void {
    const key = tokenId;

    if (side === "BUY") {
      const existing = this.portfolio.positions.get(key);

      if (existing) {
        // Update existing position
        const totalCost = existing.totalCost + price * size;
        const totalShares = existing.shares + size;
        existing.averagePrice = totalCost / totalShares;
        existing.shares = totalShares;
        existing.totalCost = totalCost;
        existing.lastPurchaseTime = timestamp;
      } else {
        // Create new position
        const position: Position = {
          tokenId,
          outcome,
          side: outcome.toUpperCase() as "YES" | "NO",
          shares: size,
          averagePrice: price,
          totalCost: price * size,
          firstPurchaseTime: timestamp,
          lastPurchaseTime: timestamp,
        };
        this.portfolio.positions.set(key, position);
      }

      this.portfolio.totalCost += price * size;
    } else {
      // SELL - reduce position
      const existing = this.portfolio.positions.get(key);

      if (existing && existing.shares >= size) {
        // Partial or full sale
        const saleValue = price * size;
        const costBasis = existing.averagePrice * size;
        const realizedPnL = saleValue - costBasis;

        existing.shares -= size;
        existing.totalCost -= costBasis;
        this.portfolio.totalCost -= costBasis;
        this.portfolio.realizedPnL += realizedPnL;

        // Remove position if fully sold
        if (existing.shares === 0) {
          this.portfolio.positions.delete(key);
        }
      }
    }

    this.recalculateValue();
  }

  /**
   * Recalculate portfolio value based on current prices
   */
  private recalculateValue(): void {
    let currentValue = 0;

    for (const [tokenId, position] of this.portfolio.positions.entries()) {
      const currentPrice = this.currentPrices.get(tokenId) || 0;
      currentValue += currentPrice * position.shares;
    }

    this.portfolio.currentValue = currentValue;
    this.portfolio.unrealizedPnL =
      this.portfolio.currentValue - this.portfolio.totalCost;
  }

  /**
   * Get current portfolio snapshot
   */
  getSnapshot(): PortfolioSnapshot {
    return {
      positions: Array.from(this.portfolio.positions.values()),
      totalCost: this.portfolio.totalCost,
      currentValue: this.portfolio.currentValue,
      unrealizedPnL: this.portfolio.unrealizedPnL,
      realizedPnL: this.portfolio.realizedPnL,
      timestamp: Date.now(),
    };
  }

  /**
   * Get position for a specific token
   */
  getPosition(tokenId: string): Position | undefined {
    return this.portfolio.positions.get(tokenId);
  }

  /**
   * Clear all positions (for testing/reset)
   */
  clear(): void {
    this.portfolio.positions.clear();
    this.portfolio.totalCost = 0;
    this.portfolio.currentValue = 0;
    this.portfolio.unrealizedPnL = 0;
    this.portfolio.realizedPnL = 0;
  }
}
