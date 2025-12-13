// src/portfolio/portfolio.ts
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
   * Uses best bid price for current value calculation
   */
  updatePrices(tokenId: string, orderBook: OrderBook): void {
    // Use best bid price (highest bid) for current value calculation
    let price = 0; // Default to 0 if no bids

    if (orderBook.bids.length > 0) {
      price = orderBook.bids[0]?.price || 0; // Best bid is first (sorted descending)
    } else if (orderBook.asks.length > 0) {
      // Fallback to ask if no bids available
      price = orderBook.asks[0].price;
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
    // DEBUG: Log incoming trade parameters
    if (process.env.DEBUG_PORTFOLIO === "true") {
      console.error(`[Portfolio.addTrade] RAW INPUTS:`);
      console.error(`  tokenId: ${tokenId}`);
      console.error(`  outcome: ${outcome}`);
      console.error(`  side: ${side}`);
      console.error(
        `  price: ${price} (type: ${typeof price}, value: ${JSON.stringify(
          price
        )})`
      );
      console.error(`  size: ${size} (type: ${typeof size})`);
      console.error(`  price * size = ${price * size}`);
      console.error(
        `  Is price > 1? ${price > 1} (should be false for Polymarket)`
      );
    }

    const key = tokenId;

    if (side === "BUY") {
      const existing = this.portfolio.positions.get(key);

      if (existing) {
        // Update existing position
        const tradeCost = price * size;
        const totalCost = existing.totalCost + tradeCost;
        const totalShares = existing.shares + size;

        // DEBUG
        if (process.env.DEBUG_PORTFOLIO === "true") {
          console.error(`[Portfolio.addTrade] UPDATING EXISTING:`);
          console.error(`  existing.totalCost: ${existing.totalCost}`);
          console.error(`  tradeCost: ${tradeCost}`);
          console.error(`  new totalCost: ${totalCost}`);
          console.error(`  new totalShares: ${totalShares}`);
          console.error(`  new averagePrice: ${totalCost / totalShares}`);
        }

        existing.averagePrice = totalCost / totalShares;
        existing.shares = totalShares;
        existing.totalCost = totalCost;
        existing.lastPurchaseTime = timestamp;
      } else {
        // Create new position
        const tradeCost = price * size;

        // DEBUG
        if (process.env.DEBUG_PORTFOLIO === "true") {
          console.error(`[Portfolio.addTrade] CREATING NEW POSITION:`);
          console.error(`  tradeCost: ${tradeCost}`);
        }

        const position: Position = {
          tokenId,
          outcome,
          side: outcome.toUpperCase() as "YES" | "NO",
          shares: size,
          averagePrice: price,
          totalCost: tradeCost,
          firstPurchaseTime: timestamp,
          lastPurchaseTime: timestamp,
        };
        this.portfolio.positions.set(key, position);
      }

      const tradeCost = price * size;
      this.portfolio.totalCost += tradeCost;

      // DEBUG
      if (process.env.DEBUG_PORTFOLIO === "true") {
        console.error(`[Portfolio.addTrade] PORTFOLIO TOTAL COST:`);
        console.error(`  Before: ${this.portfolio.totalCost - tradeCost}`);
        console.error(`  Adding: ${tradeCost}`);
        console.error(`  After: ${this.portfolio.totalCost}`);
      }
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
   * Also recalculates totalCost from positions to ensure accuracy
   */
  private recalculateValue(): void {
    let currentValue = 0;
    let recalculatedTotalCost = 0;

    for (const [tokenId, position] of this.portfolio.positions.entries()) {
      const currentPrice = this.currentPrices.get(tokenId) || 0;
      const positionValue = currentPrice * position.shares;

      // DEBUG
      if (process.env.DEBUG_PORTFOLIO === "true") {
        console.error(
          `[Portfolio.recalculateValue] Position ${tokenId.substring(
            0,
            10
          )}...:`
        );
        console.error(`  outcome: ${position.outcome}`);
        console.error(`  currentPrice: ${currentPrice}`);
        console.error(`  shares: ${position.shares}`);
        console.error(`  position.totalCost: ${position.totalCost}`);
        console.error(`  positionValue: ${positionValue}`);
      }

      currentValue += positionValue;
      // Recalculate totalCost from positions (source of truth)
      recalculatedTotalCost += position.totalCost;
    }

    this.portfolio.currentValue = currentValue;
    // Use recalculated totalCost to fix accumulation bugs
    this.portfolio.totalCost = recalculatedTotalCost;
    this.portfolio.unrealizedPnL =
      this.portfolio.currentValue - this.portfolio.totalCost;

    // DEBUG
    if (process.env.DEBUG_PORTFOLIO === "true") {
      console.error(`[Portfolio.recalculateValue] FINAL:`);
      console.error(`  currentValue: ${currentValue}`);
      console.error(`  recalculatedTotalCost: ${recalculatedTotalCost}`);
      console.error(
        `  portfolio.totalCost (set to): ${this.portfolio.totalCost}`
      );
      console.error(`  unrealizedPnL: ${this.portfolio.unrealizedPnL}`);
    }
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
