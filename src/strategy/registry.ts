/**
 * Strategy Registry - Centralized strategy management
 * Makes it easy to add, discover, and configure strategies
 */

import { BaseStrategy } from "./base";
import { StrategyConfig } from "./types";
import { PollBuyStrategy } from "./poll-buy-strategy";

export type StrategyConstructor = new (config: StrategyConfig) => BaseStrategy;

export interface StrategyDefinition {
  name: string;
  description: string;
  constructor: StrategyConstructor;
  defaultConfig: Partial<StrategyConfig>;
}

/**
 * Strategy Registry - Central place to register and retrieve strategies
 */
export class StrategyRegistry {
  private static strategies: Map<string, StrategyDefinition> = new Map();

  /**
   * Register a strategy
   */
  static register(definition: StrategyDefinition): void {
    this.strategies.set(definition.name.toLowerCase(), definition);
  }

  /**
   * Get a strategy definition by name
   */
  static get(name: string): StrategyDefinition | undefined {
    return this.strategies.get(name.toLowerCase());
  }

  /**
   * Get all registered strategies
   */
  static getAll(): StrategyDefinition[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Create a strategy instance from name and config
   */
  static create(
    name: string,
    config: Partial<StrategyConfig>
  ): BaseStrategy | null {
    const definition = this.get(name);
    if (!definition) {
      return null;
    }

    const fullConfig: StrategyConfig = {
      ...definition.defaultConfig,
      ...config,
      name: config.name || definition.name,
    } as StrategyConfig;

    return new definition.constructor(fullConfig);
  }

  /**
   * Check if a strategy exists
   */
  static exists(name: string): boolean {
    return this.strategies.has(name.toLowerCase());
  }
}

// Register built-in strategies
StrategyRegistry.register({
  name: "PollBuy",
  description: "Buys a side every N seconds",
  constructor: PollBuyStrategy,
  defaultConfig: {
    name: "PollBuy",
    enabled: true,
    intervalSeconds: 15,
    buySize: 1.0,
  },
});
