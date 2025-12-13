/**
 * Price History Tracker - Provides historical data for strategies
 */

export interface PricePoint {
  timestamp: number;
  price: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
}

export class PriceHistory {
  private history: PricePoint[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Add a new price point
   */
  add(
    price: number,
    bestBid: number,
    bestAsk: number,
    timestamp: number = Date.now()
  ): void {
    const spread = bestAsk - bestBid;
    this.history.push({
      timestamp,
      price,
      bestBid,
      bestAsk,
      spread,
    });

    // Keep only the most recent points
    if (this.history.length > this.maxSize) {
      this.history.shift();
    }
  }

  /**
   * Get all price points
   */
  getAll(): PricePoint[] {
    return [...this.history];
  }

  /**
   * Get the last N price points
   */
  getLast(n: number): PricePoint[] {
    return this.history.slice(-n);
  }

  /**
   * Get price points in a time range
   */
  getRange(startTime: number, endTime: number): PricePoint[] {
    return this.history.filter(
      (p) => p.timestamp >= startTime && p.timestamp <= endTime
    );
  }

  /**
   * Get the most recent price point
   */
  getLatest(): PricePoint | null {
    return this.history.length > 0
      ? this.history[this.history.length - 1]
      : null;
  }

  /**
   * Calculate moving average
   */
  getMovingAverage(period: number): number | null {
    if (this.history.length < period) {
      return null;
    }

    const recent = this.getLast(period);
    const sum = recent.reduce((acc, p) => acc + p.price, 0);
    return sum / period;
  }

  /**
   * Calculate price change over period
   */
  getPriceChange(periodMs: number): number | null {
    const now = Date.now();
    const then = now - periodMs;

    const recent = this.getRange(then, now);
    if (recent.length < 2) {
      return null;
    }

    const first = recent[0].price;
    const last = recent[recent.length - 1].price;
    return last - first;
  }

  /**
   * Get volatility (standard deviation) over period
   */
  getVolatility(period: number): number | null {
    if (this.history.length < period) {
      return null;
    }

    const recent = this.getLast(period);
    const mean = recent.reduce((acc, p) => acc + p.price, 0) / period;
    const variance =
      recent.reduce((acc, p) => acc + Math.pow(p.price - mean, 2), 0) / period;
    return Math.sqrt(variance);
  }

  /**
   * Clear history
   */
  clear(): void {
    this.history = [];
  }

  /**
   * Get history size
   */
  size(): number {
    return this.history.length;
  }
}
