/**
 * Poll Buy Strategy - Buys a side every N seconds
 */

import { BaseStrategy } from "./base";
import { StrategyContext, StrategyResult, StrategyConfig } from "./types";

export interface PollBuyStrategyConfig extends StrategyConfig {
  intervalSeconds?: number; // How often to buy (default: 15)
  buySize?: number; // Amount to buy each time (in shares, default: 1.0)
  targetTokenId?: string; // Specific token ID to buy (if not provided, uses context tokenId)
  targetOutcome?: string; // Outcome name (YES/NO) for display purposes
}

export class PollBuyStrategy extends BaseStrategy {
  private lastExecutionTime: number = 0;
  private executionCount: number = 0;
  private targetTokenId: string | null = null;

  constructor(config: PollBuyStrategyConfig) {
    super(config);
    this.targetTokenId = config.targetTokenId || null;
  }

  initialize(context: StrategyContext): void {
    this.lastExecutionTime = Date.now();
    this.executionCount = 0;
    // If no target token specified, use context token
    if (!this.targetTokenId) {
      this.targetTokenId = context.tokenId;
    }
  }

  evaluate(context: StrategyContext): StrategyResult {
    if (!this.isEnabled()) {
      return { shouldExecute: false };
    }

    const config = this.config as PollBuyStrategyConfig;
    const intervalMs = (config.intervalSeconds || 15) * 1000;
    const now = Date.now();
    const timeSinceLastExecution = now - this.lastExecutionTime;

    if (timeSinceLastExecution >= intervalMs) {
      this.lastExecutionTime = now;
      this.executionCount++;

      return {
        shouldExecute: true,
        trade: {
          side: "BUY",
          size: config.buySize || 1.0,
          tokenId: this.targetTokenId || undefined,
          // Price will be determined by market (walking the order book)
        },
      };
    }

    return { shouldExecute: false };
  }

  onTradeExecuted(trade: {
    side: "BUY" | "SELL";
    price: number;
    size: number;
    timestamp: number;
  }): void {
    // Track execution for debugging
  }

  getExecutionCount(): number {
    return this.executionCount;
  }
}

