# Strategy Development Guide

This guide explains how to add new strategies to the simulator.

## Quick Start: Adding a New Strategy

### Step 1: Create Your Strategy File

Create a new file in `src/strategy/` (e.g., `my-strategy.ts`):

```typescript
import { BaseStrategy } from "./base";
import { StrategyContext, StrategyResult, StrategyConfig } from "./types";

export interface MyStrategyConfig extends StrategyConfig {
  // Add your custom config properties here
  myParameter?: number;
}

export class MyStrategy extends BaseStrategy {
  constructor(config: MyStrategyConfig) {
    super(config);
  }

  evaluate(context: StrategyContext): StrategyResult {
    // Your strategy logic here

    // Return a trade to execute:
    return {
      shouldExecute: true,
      trade: {
        side: "BUY", // or "SELL"
        size: 1.0,
      },
    };

    // Or skip this evaluation:
    return { shouldExecute: false };
  }
}
```

### Step 2: Register Your Strategy

Add your strategy to `src/strategy/registry.ts`:

```typescript
import { MyStrategy } from "./my-strategy";

StrategyRegistry.register({
  name: "MyStrategy",
  description: "Description of what your strategy does",
  constructor: MyStrategy,
  defaultConfig: {
    name: "MyStrategy",
    enabled: true,
    myParameter: 10, // Your default values
  },
});
```

### Step 3: Use Your Strategy

In `src/index.ts`, you can now create and add your strategy:

```typescript
import { StrategyRegistry } from "./strategy/registry";

// Create strategy from registry
const myStrategy = StrategyRegistry.create("MyStrategy", {
  enabled: true,
  myParameter: 15,
});

if (myStrategy) {
  simulator.addStrategy(myStrategy);
}
```

Or create it directly:

```typescript
import { MyStrategy } from "./strategy/my-strategy";

const myStrategy = new MyStrategy({
  name: "MyStrategy",
  enabled: true,
  myParameter: 15,
});

simulator.addStrategy(myStrategy);
```

## Strategy Context

The `StrategyContext` provides real-time market data:

```typescript
interface StrategyContext {
  tokenId: string; // Token ID being traded
  marketName: string; // Market name
  outcome: string; // Outcome name (e.g., "Up", "Down")
  currentPrice: number; // Best ask price (for buying)
  bestBid: number; // Best bid price (for selling)
  bestAsk: number; // Best ask price
  timestamp: number; // Current timestamp
  history?: PriceHistory; // Historical price data (optional)
}
```

## Using Price History

If you need historical data, use the `history` field:

```typescript
evaluate(context: StrategyContext): StrategyResult {
  if (!context.history) {
    return { shouldExecute: false };
  }

  // Get last 20 price points
  const recent = context.history.getLast(20);

  // Calculate moving average
  const ma = context.history.getMovingAverage(20);

  // Get price change over last minute
  const change = context.history.getPriceChange(60000);

  // Get volatility
  const volatility = context.history.getVolatility(20);

  // Your strategy logic...
}
```

## Strategy Lifecycle

Strategies have a lifecycle you can hook into:

```typescript
class MyStrategy extends BaseStrategy {
  // Called once when simulator starts
  initialize(context: StrategyContext): void {
    // Initialize your strategy state
  }

  // Called periodically (every evaluationIntervalMs)
  evaluate(context: StrategyContext): StrategyResult {
    // Your main strategy logic
  }

  // Called after a trade is executed
  onTradeExecuted(trade: {
    side: "BUY" | "SELL";
    price: number;
    size: number;
    timestamp: number;
  }): void {
    // Update your strategy state based on executed trade
  }

  // Called when simulator stops
  cleanup(): void {
    // Clean up resources
  }
}
```

## Example Strategies

See `src/strategy/` for examples:

- `poll-buy-strategy.ts` - Simple polling strategy
- `example-mean-reversion.ts` - Mean reversion example

## Best Practices

1. **Rate Limiting**: Don't trade too frequently. Add a minimum time between trades.

2. **Error Handling**: The simulator catches errors, but handle edge cases in your strategy.

3. **State Management**: Use instance variables to track strategy state between evaluations.

4. **Configuration**: Make your strategy configurable via the config object.

5. **Testing**: Test your strategy with different market conditions.

## Advanced: Multiple Strategy Instances

You can add multiple instances of the same strategy with different configs:

```typescript
const strategy1 = new MyStrategy({
  name: "MyStrategy-Aggressive",
  enabled: true,
  myParameter: 10,
});

const strategy2 = new MyStrategy({
  name: "MyStrategy-Conservative",
  enabled: true,
  myParameter: 5,
});

simulator.addStrategy(strategy1);
simulator.addStrategy(strategy2);
```

## Strategy Registry

The registry makes it easy to discover and create strategies:

```typescript
import { StrategyRegistry } from "./strategy/registry";

// List all available strategies
const allStrategies = StrategyRegistry.getAll();
allStrategies.forEach((s) => {
  console.log(`${s.name}: ${s.description}`);
});

// Create a strategy by name
const strategy = StrategyRegistry.create("PollBuy", {
  intervalSeconds: 30,
});
```
