/**
 * Example: Mean Reversion Strategy
 *
 * This is an example of how easy it is to add a new strategy.
 * This strategy buys when price is below the moving average and sells when above.
 */

import { BaseStrategy } from "./base";
import { StrategyContext, StrategyResult, StrategyConfig } from "./types";

export interface MeanReversionConfig extends StrategyConfig {
  lookbackPeriod?: number; // Number of price points to use for moving average (default: 20)
  buyThreshold?: number; // Buy when price is this % below mean (default: 0.95 = 5% below)
  sellThreshold?: number; // Sell when price is this % above mean (default: 1.05 = 5% above)
  buySize?: number; // Amount to buy (default: 1.0)
  sellSize?: number; // Amount to sell (default: 1.0)
}

export class MeanReversionStrategy extends BaseStrategy {
  private lastTradeTime: number = 0;
  private minTradeInterval: number = 5000; // Don't trade more than once per 5 seconds

  constructor(config: MeanReversionConfig) {
    super(config);
  }

  evaluate(context: StrategyContext): StrategyResult {
    if (!this.isEnabled()) {
      return { shouldExecute: false };
    }

    const config = this.config as MeanReversionConfig;
    const lookback = config.lookbackPeriod || 20;
    const buyThreshold = config.buyThreshold || 0.95;
    const sellThreshold = config.sellThreshold || 1.05;
    const buySize = config.buySize || 1.0;
    const sellSize = config.sellSize || 1.0;

    // Need history to calculate moving average
    if (!context.history || context.history.size() < lookback) {
      return { shouldExecute: false };
    }

    // Calculate moving average
    const movingAvg = context.history.getMovingAverage(lookback);
    if (movingAvg === null) {
      return { shouldExecute: false };
    }

    // Rate limiting: don't trade too frequently
    const now = Date.now();
    if (now - this.lastTradeTime < this.minTradeInterval) {
      return { shouldExecute: false };
    }

    const currentPrice = context.currentPrice;

    // Buy if price is significantly below moving average (oversold)
    if (currentPrice < movingAvg * buyThreshold) {
      this.lastTradeTime = now;
      return {
        shouldExecute: true,
        trade: {
          side: "BUY",
          size: buySize,
        },
      };
    }

    // Sell if price is significantly above moving average (overbought)
    if (currentPrice > movingAvg * sellThreshold) {
      this.lastTradeTime = now;
      return {
        shouldExecute: true,
        trade: {
          side: "SELL",
          size: sellSize,
        },
      };
    }

    return { shouldExecute: false };
  }
}
