import blessed from "blessed";
import { Trade, OrderBook } from "../types";

export class DashboardUI {
  private screen: blessed.Widgets.Screen;
  private tradesBox: blessed.Widgets.BoxElement;
  private orderBookBox: blessed.Widgets.BoxElement;
  private statusBar: blessed.Widgets.BoxElement;
  private tokenId: string;
  private marketName: string;
  private outcome: string;

  constructor(tokenId: string, marketName?: string, outcome?: string) {
    this.tokenId = tokenId;
    this.marketName = marketName || "Unknown Market";
    this.outcome = outcome || "Unknown";

    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: "Polymarket Live Dashboard",
    });

    // Status bar at top
    this.statusBar = blessed.box({
      top: 0,
      left: 0,
      width: "100%",
      height: 3,
      content: this.formatStatusBar(false),
      tags: true,
      border: {
        type: "line",
      },
      style: {
        fg: "white",
        border: {
          fg: "cyan",
        },
      },
    });

    // Trades panel (left side)
    this.tradesBox = blessed.box({
      top: 3,
      left: 0,
      width: "50%",
      height: "100%-3",
      label: " Recent Trades (0) ",
      tags: true,
      border: {
        type: "line",
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: " ",
        style: {
          bg: "blue",
        },
      },
      style: {
        fg: "white",
        border: {
          fg: "green",
        },
      },
    });

    // Order book panel (right side)
    this.orderBookBox = blessed.box({
      top: 3,
      left: "50%",
      width: "50%",
      height: "100%-3",
      label: " Order Book ",
      tags: true,
      border: {
        type: "line",
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: " ",
        style: {
          bg: "blue",
        },
      },
      style: {
        fg: "white",
        border: {
          fg: "yellow",
        },
      },
    });

    // Add elements to screen
    this.screen.append(this.statusBar);
    this.screen.append(this.tradesBox);
    this.screen.append(this.orderBookBox);

    // Quit on Escape, q, or Control-C
    this.screen.key(["escape", "q", "C-c"], () => {
      return process.exit(0);
    });

    // Initial render
    this.screen.render();
  }

  public update(
    trades: Trade[],
    orderBook: OrderBook,
    connected: boolean
  ): void {
    // Update status bar
    this.statusBar.setContent(this.formatStatusBar(connected));

    // Update trades panel with count in label
    this.tradesBox.setLabel(` Recent Trades (${trades.length}) `);
    this.tradesBox.setContent(this.formatTrades(trades));

    // Update order book
    this.orderBookBox.setContent(this.formatOrderBook(orderBook));

    // Render
    this.screen.render();
  }

  public destroy(): void {
    this.screen.destroy();
  }

  private formatStatusBar(connected: boolean): string {
    const status = connected
      ? "{green-fg}● Connected{/green-fg}"
      : "{red-fg}● Disconnected{/red-fg}";

    // Truncate market name if too long
    const maxNameLen = 40;
    const displayName =
      this.marketName.length > maxNameLen
        ? this.marketName.substring(0, maxNameLen - 3) + "..."
        : this.marketName;

    const now = new Date().toLocaleTimeString();

    return `  ${status}  |  {bold}${displayName}{/bold}  |  Outcome: {cyan-fg}${this.outcome}{/cyan-fg}  |  {gray-fg}${now}{/gray-fg}  |  Press {bold}q{/bold} to quit`;
  }

  private formatTrades(trades: Trade[]): string {
    if (trades.length === 0) {
      const now = new Date().toLocaleTimeString();
      return `\n  {gray-fg}Waiting for trades... (${now}){/gray-fg}\n\n  {yellow-fg}💡 Tip: Trades appear when orders match. The order book\n     updates frequently, but trades may be less common.{/yellow-fg}\n\n  {cyan-fg}Try a high-volume market for more activity:{/cyan-fg}\n  {gray-fg}npm run find-tokens{/gray-fg}`;
    }

    const header =
      "  {bold}Time          Side    Price      Size        Value (USDC){/bold}\n" +
      "  ───────────────────────────────────────────────────────────────\n";

    const rows = trades.slice(0, 50).map((trade) => {
      const time = new Date(trade.timestamp).toLocaleTimeString();
      const side =
        trade.side === "BUY"
          ? "{green-fg}BUY {/green-fg}"
          : "{red-fg}SELL{/red-fg}";
      const price = trade.price.toFixed(4).padStart(8);
      const size = trade.size.toFixed(2).padStart(10);
      const notional = trade.notional.toFixed(2).padStart(12);

      return `  ${time}  ${side}  ${price}  ${size}  ${notional}`;
    });

    return header + rows.join("\n");
  }

  private formatOrderBook(orderBook: OrderBook): string {
    if (orderBook.bids.length === 0 && orderBook.asks.length === 0) {
      return "\n  {gray-fg}Waiting for order book...{/gray-fg}";
    }

    const maxLevels = 30;

    // Sort asks ascending (lowest price first)
    const sortedAsks = [...orderBook.asks].sort((a, b) => a.price - b.price);

    // Sort bids descending (highest price first)
    const sortedBids = [...orderBook.bids].sort((a, b) => b.price - a.price);

    const header =
      "  {bold}       Price      Size    |       Price      Size{/bold}\n" +
      "  {bold}       (Ask)              |       (Bid)             {/bold}\n" +
      "  ──────────────────────────────────────────────────────────\n";

    const rows: string[] = [];
    const numRows = Math.max(
      Math.min(sortedAsks.length, maxLevels),
      Math.min(sortedBids.length, maxLevels)
    );

    for (let i = 0; i < numRows; i++) {
      const ask = i < sortedAsks.length ? sortedAsks[i] : null;
      const bid = i < sortedBids.length ? sortedBids[i] : null;

      const askPrice = ask ? ask.price.toFixed(4).padStart(10) : "          ";
      const askSize = ask ? ask.size.toFixed(2).padStart(9) : "         ";

      const bidPrice = bid ? bid.price.toFixed(4).padStart(10) : "          ";
      const bidSize = bid ? bid.size.toFixed(2).padStart(9) : "         ";

      rows.push(
        `  {red-fg}${askPrice}  ${askSize}{/red-fg}  |  {green-fg}${bidPrice}  ${bidSize}{/green-fg}`
      );
    }

    // Calculate spread
    let spreadText = "";
    if (sortedAsks.length > 0 && sortedBids.length > 0) {
      const bestAsk = sortedAsks[0].price;
      const bestBid = sortedBids[0].price;
      const spread = bestAsk - bestBid;
      const spreadBps = ((spread / bestBid) * 10000).toFixed(2);
      spreadText = `\n  ──────────────────────────────────────────────────────────\n  Spread: {cyan-fg}${spread.toFixed(
        4
      )} (${spreadBps} bps){/cyan-fg}`;
    }

    return header + rows.join("\n") + spreadText;
  }
}
