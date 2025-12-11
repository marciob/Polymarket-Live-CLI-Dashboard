// src/simulator/simulator.ts
/**
 * Strategy Simulator - Executes strategies and tracks simulated trades
 */

import { BaseStrategy } from "../strategy/base";
import { StrategyContext, SimulatedTrade } from "../strategy/types";
import { PortfolioTracker } from "../portfolio/portfolio";
import { OrderBook } from "../types";

export interface SimulatorConfig {
  initialCapital?: number; // Starting capital (for reference, not enforced)
  evaluationIntervalMs?: number; // How often to evaluate strategies (default: 1000ms)
}

export class StrategySimulator {
  private strategies: BaseStrategy[] = [];
  private portfolio: PortfolioTracker;
  private simulatedTrades: SimulatedTrade[] = [];
  private evaluationInterval: NodeJS.Timeout | null = null;
  private config: SimulatorConfig;
  private currentContext: StrategyContext | null = null;
  private currentOrderBook: OrderBook | null = null;
  private tradeCallbacks: Array<(trade: SimulatedTrade) => void> = [];

  constructor(config: SimulatorConfig = {}) {
    this.config = {
      evaluationIntervalMs: 1000, // Evaluate every second
      ...config,
    };
    this.portfolio = new PortfolioTracker();
  }

  /**
   * Add a strategy to the simulator
   */
  addStrategy(strategy: BaseStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Remove a strategy
   */
  removeStrategy(strategyName: string): void {
    this.strategies = this.strategies.filter(
      (s) => s.getName() !== strategyName
    );
  }

  /**
   * Start the simulator
   */
  start(context: StrategyContext): void {
    this.currentContext = context;

    // Initialize all strategies
    for (const strategy of this.strategies) {
      if (strategy.isEnabled()) {
        strategy.initialize(context);
      }
    }

    // Start evaluation loop
    this.evaluationInterval = setInterval(() => {
      this.evaluateStrategies();
    }, this.config.evaluationIntervalMs);
  }

  /**
   * Stop the simulator
   */
  stop(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }

    // Cleanup strategies
    for (const strategy of this.strategies) {
      strategy.cleanup();
    }
  }

  /**
   * Update market data (order book)
   */
  updateMarket(tokenId: string, orderBook: OrderBook): void {
    // Store current order book for execution
    this.currentOrderBook = orderBook;

    // Calculate current price (midpoint)
    let currentPrice = 0.5;
    const bestBid = orderBook.bids[0]?.price || 0;
    const bestAsk = orderBook.asks[0]?.price || 1;

    if (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
      currentPrice = (bestBid + bestAsk) / 2;
    } else if (orderBook.asks.length > 0) {
      currentPrice = bestAsk;
    } else if (orderBook.bids.length > 0) {
      currentPrice = bestBid;
    }

    // Update portfolio with current price
    this.portfolio.setPrice(tokenId, currentPrice);

    // Update context if we have one
    if (this.currentContext) {
      this.currentContext = {
        ...this.currentContext,
        currentPrice: bestAsk, // Use best ask for buying
        bestBid,
        bestAsk,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Evaluate all strategies and execute trades
   */
  private evaluateStrategies(): void {
    if (!this.currentContext) {
      return;
    }

    for (const strategy of this.strategies) {
      if (!strategy.isEnabled()) {
        continue;
      }

      try {
        const result = strategy.evaluate(this.currentContext);

        if (result.shouldExecute && result.trade) {
          this.executeTrade(strategy.getName(), result.trade);
        }
      } catch (error) {
        // Log error but continue with other strategies
        console.error(
          `Error evaluating strategy ${strategy.getName()}:`,
          error
        );
      }
    }
  }

  /**
   * Calculate average execution price by walking the order book
   */
  private calculateExecutionPrice(
    side: "BUY" | "SELL",
    size: number
  ): { averagePrice: number; canFill: boolean } {
    if (!this.currentOrderBook) {
      // Fallback to context prices if no order book
      if (this.currentContext) {
        const price =
          side === "BUY"
            ? this.currentContext.bestAsk || this.currentContext.currentPrice
            : this.currentContext.bestBid || this.currentContext.currentPrice;
        return { averagePrice: price, canFill: true };
      }
      return { averagePrice: 0.5, canFill: false };
    }

    let remainingSize = size;
    let totalCost = 0;
    const levels =
      side === "BUY" ? this.currentOrderBook.asks : this.currentOrderBook.bids;

    // For BUY: walk asks (ascending price)
    // For SELL: walk bids (descending price)
    if (side === "BUY") {
      // Sort asks ascending (cheapest first)
      const sortedAsks = [...levels].sort((a, b) => a.price - b.price);
      for (const level of sortedAsks) {
        if (remainingSize <= 0) break;

        const fillSize = Math.min(remainingSize, level.size);
        totalCost += fillSize * level.price;
        remainingSize -= fillSize;
      }
    } else {
      // Sort bids descending (highest first)
      const sortedBids = [...levels].sort((a, b) => b.price - a.price);
      for (const level of sortedBids) {
        if (remainingSize <= 0) break;

        const fillSize = Math.min(remainingSize, level.size);
        totalCost += fillSize * level.price;
        remainingSize -= fillSize;
      }
    }

    if (remainingSize > 0) {
      // Can't fill completely, use best available price for remaining
      const bestPrice =
        side === "BUY"
          ? this.currentOrderBook.asks[0]?.price || 1
          : this.currentOrderBook.bids[0]?.price || 0;
      totalCost += remainingSize * bestPrice;
    }

    const averagePrice = size > 0 ? totalCost / size : 0;
    const canFill = remainingSize === 0 || levels.length > 0;

    return { averagePrice, canFill };
  }

  /**
   * Execute a simulated trade
   */
  private executeTrade(
    strategyName: string,
    trade: {
      side: "BUY" | "SELL";
      size: number;
      price?: number;
      tokenId?: string;
    }
  ): void {
    if (!this.currentContext) {
      return;
    }

    // Use trade tokenId if provided, otherwise use context tokenId
    const tradeTokenId = trade.tokenId || this.currentContext.tokenId;

    // Determine execution price
    let executionPrice: number;
    if (trade.price !== undefined) {
      executionPrice = trade.price;
    } else {
      // Walk the order book to get best average execution price
      const execution = this.calculateExecutionPrice(trade.side, trade.size);
      executionPrice = execution.averagePrice;

      // DEBUG: Log order book calculation
      if (process.env.DEBUG_PORTFOLIO === "true") {
        console.error(`[Simulator.calculateExecutionPrice] Result:`);
        console.error(`  averagePrice: ${executionPrice}`);
        console.error(`  canFill: ${execution.canFill}`);
        if (this.currentOrderBook) {
          const levels =
            trade.side === "BUY"
              ? this.currentOrderBook.asks
              : this.currentOrderBook.bids;
          console.error(
            `  Order book levels (first 3):`,
            levels.slice(0, 3).map((l) => `price=${l.price}, size=${l.size}`)
          );
        }
      }
    }

    // DEBUG: Log execution price before creating trade
    if (process.env.DEBUG_PORTFOLIO === "true") {
      console.error(`[Simulator.executeTrade] BEFORE CREATING TRADE:`);
      console.error(`  side: ${trade.side}`);
      console.error(
        `  executionPrice: ${executionPrice} (type: ${typeof executionPrice})`
      );
      console.error(`  size: ${trade.size} (type: ${typeof trade.size})`);
      console.error(`  notional: ${executionPrice * trade.size}`);
      console.error(
        `  Is executionPrice > 1? ${
          executionPrice > 1
        } (should be false for Polymarket)`
      );
    }

    // Create simulated trade
    const simulatedTrade: SimulatedTrade = {
      id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      tokenId: tradeTokenId,
      side: trade.side,
      price: executionPrice,
      size: trade.size,
      notional: executionPrice * trade.size,
      strategyName,
    };

    // Add to portfolio (use context outcome, or try to find it)
    const outcome = this.currentContext.outcome;

    // Debug: Log before adding to portfolio
    if (process.env.DEBUG_PORTFOLIO === "true") {
      console.error(`[Simulator.executeTrade] CALLING portfolio.addTrade:`);
      console.error(`  executionPrice: ${executionPrice}`);
      console.error(`  trade.size: ${trade.size}`);
    }

    this.portfolio.addTrade(
      tradeTokenId,
      outcome,
      trade.side,
      executionPrice,
      trade.size,
      Date.now()
    );

    // Notify strategy
    for (const strategy of this.strategies) {
      if (strategy.getName() === strategyName) {
        strategy.onTradeExecuted({
          side: trade.side,
          price: executionPrice,
          size: trade.size,
          timestamp: Date.now(),
        });
        break;
      }
    }

    // Store trade
    this.simulatedTrades.unshift(simulatedTrade);
    if (this.simulatedTrades.length > 1000) {
      this.simulatedTrades = this.simulatedTrades.slice(0, 1000);
    }

    // Notify callbacks
    for (const callback of this.tradeCallbacks) {
      callback(simulatedTrade);
    }
  }

  /**
   * Register callback for trade events
   */
  onTrade(callback: (trade: SimulatedTrade) => void): void {
    this.tradeCallbacks.push(callback);
  }

  /**
   * Get simulated trades
   */
  getTrades(): SimulatedTrade[] {
    return this.simulatedTrades;
  }

  /**
   * Get portfolio tracker
   */
  getPortfolio(): PortfolioTracker {
    return this.portfolio;
  }

  /**
   * Get current context
   */
  getContext(): StrategyContext | null {
    return this.currentContext;
  }
}
