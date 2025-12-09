# Strategy System

This directory contains the strategy system for simulating trading strategies on Polymarket.

## Architecture

The strategy system is designed to be extensible and easy to use:

- **Base Strategy** (`base.ts`): Abstract base class that all strategies extend
- **Strategy Types** (`types.ts`): Type definitions for strategies
- **Strategy Simulator** (`../simulator/simulator.ts`): Executes strategies and tracks trades
- **Portfolio Tracker** (`../portfolio/portfolio.ts`): Tracks positions and calculates P&L

## Creating a New Strategy

To create a new strategy, extend the `BaseStrategy` class:

```typescript
import { BaseStrategy } from "./base";
import { StrategyContext, StrategyResult, StrategyConfig } from "./types";

export class MyStrategy extends BaseStrategy {
  constructor(config: StrategyConfig) {
    super(config);
  }

  evaluate(context: StrategyContext): StrategyResult {
    // Your strategy logic here
    // Return { shouldExecute: true, trade: {...} } to execute a trade
    // Return { shouldExecute: false } to skip
    return { shouldExecute: false };
  }
}
```

## Strategy Context

The `StrategyContext` provides real-time market data:

```typescript
interface StrategyContext {
  tokenId: string;
  marketName: string;
  outcome: string;
  currentPrice: number;  // Best ask price for buying
  bestBid: number;
  bestAsk: number;
  timestamp: number;
}
```

## Example: Mean Reversion Strategy

```typescript
import { BaseStrategy } from "./base";
import { StrategyContext, StrategyResult } from "./types";

export class MeanReversionStrategy extends BaseStrategy {
  private priceHistory: number[] = [];
  private readonly lookbackPeriod = 20;

  evaluate(context: StrategyContext): StrategyResult {
    // Add current price to history
    this.priceHistory.push(context.currentPrice);
    if (this.priceHistory.length > this.lookbackPeriod) {
      this.priceHistory.shift();
    }

    if (this.priceHistory.length < this.lookbackPeriod) {
      return { shouldExecute: false };
    }

    // Calculate mean
    const mean = this.priceHistory.reduce((a, b) => a + b) / this.priceHistory.length;
    const currentPrice = context.currentPrice;

    // Buy if price is below mean (oversold)
    if (currentPrice < mean * 0.95) {
      return {
        shouldExecute: true,
        trade: {
          side: "BUY",
          size: 1.0,
        },
      };
    }

    // Sell if price is above mean (overbought)
    if (currentPrice > mean * 1.05) {
      return {
        shouldExecute: true,
        trade: {
          side: "SELL",
          size: 1.0,
        },
      };
    }

    return { shouldExecute: false };
  }
}
```

## Using Strategies

Strategies are added to the simulator in `src/index.ts`:

```typescript
import { MyStrategy } from "./strategy/my-strategy";

const simulator = new StrategySimulator();
const myStrategy = new MyStrategy({
  name: "MyStrategy",
  enabled: true,
  // ... custom config
});

simulator.addStrategy(myStrategy);
```

## Available Strategies

- **PollBuyStrategy**: Buys a side every N seconds (default: 15s)

