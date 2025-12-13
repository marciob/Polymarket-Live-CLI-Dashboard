/**
 * Strategy types and interfaces
 */

import { PriceHistory } from "./history";

export interface StrategyContext {
  tokenId: string;
  marketName: string;
  outcome: string;
  currentPrice: number; // Best ask price for buying
  bestBid: number;
  bestAsk: number;
  timestamp: number;
  history?: PriceHistory; // Optional: historical price data
}

export interface SimulatedTrade {
  id: string;
  timestamp: number;
  tokenId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  notional: number;
  strategyName: string;
}

export interface StrategyConfig {
  name: string;
  enabled: boolean;
  [key: string]: any; // Allow custom config properties
}

export interface StrategyResult {
  shouldExecute: boolean;
  trade?: {
    side: "BUY" | "SELL";
    size: number;
    price?: number; // Optional, will use market price if not provided
    tokenId?: string; // Optional, will use context tokenId if not provided
  };
}
