/**
 * Portfolio and position types
 */

export interface Position {
  tokenId: string;
  outcome: string;
  side: "YES" | "NO";
  shares: number;
  averagePrice: number;
  totalCost: number;
  firstPurchaseTime: number;
  lastPurchaseTime: number;
}

export interface Portfolio {
  positions: Map<string, Position>; // key: tokenId
  totalCost: number;
  currentValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
}

export interface PortfolioSnapshot {
  positions: Position[];
  totalCost: number;
  currentValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
  timestamp: number;
}

