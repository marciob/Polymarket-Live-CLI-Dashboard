import WebSocket from "ws";
import {
  WebSocketMessage,
  BookMessage,
  LastTradeMessage,
  PriceChangeMessage,
  OrderBook,
  Trade,
  OrderBookLevel,
} from "../types";

const WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const PING_INTERVAL = 10000; // 10 seconds
const RECONNECT_DELAY = 5000; // 5 seconds

export type MessageHandler = (
  trades: Trade[],
  orderBook: OrderBook,
  connected: boolean
) => void;

export class PolymarketWebSocketClient {
  private ws: WebSocket | null = null;
  private tokenId: string;
  private messageHandler: MessageHandler;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private shouldReconnect = true;

  // State
  private trades: Trade[] = [];
  private orderBook: OrderBook = {
    bids: [],
    asks: [],
    lastUpdate: 0,
  };

  constructor(tokenId: string, messageHandler: MessageHandler) {
    this.tokenId = tokenId;
    this.messageHandler = messageHandler;
  }

  public connect(): void {
    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.on("open", () => {
        this.onOpen();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        this.onMessage(data);
      });

      this.ws.on("error", (error: Error) => {
        this.onError(error);
      });

      this.ws.on("close", () => {
        this.onClose();
      });
    } catch (error) {
      this.handleReconnect();
    }
  }

  public disconnect(): void {
    this.shouldReconnect = false;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private onOpen(): void {
    // Subscribe to market channel
    const subscribeMessage = {
      assets_ids: [this.tokenId],
      type: "market",
    };

    this.ws?.send(JSON.stringify(subscribeMessage));

    // Start ping interval
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send("PING");
      }
    }, PING_INTERVAL);

    // Notify connected
    this.notifyUpdate(true);
  }

  private onMessage(data: WebSocket.Data): void {
    try {
      const message = data.toString();

      // Ignore pong responses
      if (message === "PONG" || message === "PING") {
        return;
      }

      const parsed: WebSocketMessage = JSON.parse(message);

      switch (parsed.event_type) {
        case "book":
          this.handleBookMessage(parsed);
          break;
        case "last_trade_price":
          this.handleTradeMessage(parsed);
          break;
        case "price_change":
          this.handlePriceChange(parsed);
          break;
        // tick_size_change ignored for now
      }
    } catch (error) {
      // Silently ignore parse errors
    }
  }

  private handleBookMessage(message: BookMessage): void {
    this.orderBook = {
      bids: message.bids.map((b) => ({
        price: parseFloat(b.price),
        size: parseFloat(b.size),
      })),
      asks: message.asks.map((a) => ({
        price: parseFloat(a.price),
        size: parseFloat(a.size),
      })),
      lastUpdate: parseInt(message.timestamp),
    };

    this.notifyUpdate(true);
  }

  private handleTradeMessage(message: LastTradeMessage): void {
    const price = parseFloat(message.price);
    const size = parseFloat(message.size);

    const trade: Trade = {
      timestamp: parseInt(message.timestamp),
      side: message.side,
      price,
      size,
      notional: price * size,
    };

    // Keep last 100 trades
    this.trades.unshift(trade);
    if (this.trades.length > 100) {
      this.trades = this.trades.slice(0, 100);
    }

    this.notifyUpdate(true);
  }

  private handlePriceChange(message: PriceChangeMessage): void {
    // Update order book levels based on price changes
    for (const change of message.price_changes) {
      const price = parseFloat(change.price);
      const size = parseFloat(change.size);

      if (change.side === "BUY") {
        this.updateLevel(this.orderBook.bids, price, size);
      } else {
        this.updateLevel(this.orderBook.asks, price, size);
      }
    }

    this.orderBook.lastUpdate = parseInt(message.timestamp);
    this.notifyUpdate(true);
  }

  private updateLevel(
    levels: OrderBookLevel[],
    price: number,
    size: number
  ): void {
    const index = levels.findIndex((l) => l.price === price);

    if (size === 0) {
      // Remove level
      if (index !== -1) {
        levels.splice(index, 1);
      }
    } else {
      // Update or add level
      if (index !== -1) {
        levels[index].size = size;
      } else {
        levels.push({ price, size });
      }
    }

    // Keep sorted (bids descending, asks ascending handled in UI)
  }

  private onError(error: Error): void {
    // Error handled in close event
  }

  private onClose(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    this.notifyUpdate(false);

    if (this.shouldReconnect) {
      this.handleReconnect();
    }
  }

  private handleReconnect(): void {
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, RECONNECT_DELAY);
  }

  private notifyUpdate(connected: boolean): void {
    this.messageHandler(this.trades, this.orderBook, connected);
  }
}
