/**
 * Base strategy interface
 */

import { StrategyContext, StrategyResult, StrategyConfig } from "./types";

export abstract class BaseStrategy {
  protected config: StrategyConfig;

  constructor(config: StrategyConfig) {
    this.config = config;
  }

  /**
   * Get the strategy name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Check if strategy is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Initialize the strategy (called once when simulator starts)
   */
  initialize(context: StrategyContext): void {
    // Override in subclasses if needed
  }

  /**
   * Evaluate the strategy and determine if a trade should be executed
   * This is called periodically based on the strategy's timing requirements
   */
  abstract evaluate(context: StrategyContext): StrategyResult;

  /**
   * Called after a trade is executed
   */
  onTradeExecuted(trade: {
    side: "BUY" | "SELL";
    price: number;
    size: number;
    timestamp: number;
  }): void {
    // Override in subclasses if needed
  }

  /**
   * Cleanup when strategy is stopped
   */
  cleanup(): void {
    // Override in subclasses if needed
  }
}

