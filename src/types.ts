/**
 * TypeScript types for Polymarket CLOB WebSocket messages
 */

export interface OrderSummary {
  price: string;
  size: string;
}

export interface BookMessage {
  event_type: "book";
  asset_id: string;
  market: string;
  timestamp: string;
  hash: string;
  bids: OrderSummary[];
  asks: OrderSummary[];
}

export interface LastTradeMessage {
  event_type: "last_trade_price";
  asset_id: string;
  market: string;
  price: string;
  side: "BUY" | "SELL";
  size: string;
  timestamp: string;
  fee_rate_bps: string;
}

export interface PriceChange {
  asset_id: string;
  price: string;
  size: string;
  side: "BUY" | "SELL";
  hash: string;
  best_bid: string;
  best_ask: string;
}

export interface PriceChangeMessage {
  event_type: "price_change";
  market: string;
  price_changes: PriceChange[];
  timestamp: string;
}

export interface TickSizeChangeMessage {
  event_type: "tick_size_change";
  asset_id: string;
  market: string;
  old_tick_size: string;
  new_tick_size: string;
  timestamp: string;
  side: string;
}

export type WebSocketMessage =
  | BookMessage
  | LastTradeMessage
  | PriceChangeMessage
  | TickSizeChangeMessage;

export interface Trade {
  timestamp: number;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  notional: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastUpdate: number;
}

export interface DashboardState {
  trades: Trade[];
  orderBook: OrderBook;
  connected: boolean;
  tokenId: string;
}

