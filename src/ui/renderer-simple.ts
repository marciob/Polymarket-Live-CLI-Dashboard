import blessed from "blessed";
import { Trade, OrderBook } from "../types";
import { SimulatedTrade } from "../strategy/types";
import { PortfolioSnapshot } from "../portfolio/types";

export class DashboardUI {
  private screen: blessed.Widgets.Screen;
  private tradesBox: blessed.Widgets.BoxElement;
  private simulatedTradesBox: blessed.Widgets.BoxElement;
  private orderBookBox: blessed.Widgets.BoxElement;
  private portfolioBox: blessed.Widgets.BoxElement;
  private statusBar: blessed.Widgets.BoxElement;
  private tokenId: string;
  private marketName: string;
  private outcome: string;
  private isExiting: boolean = false;

  constructor(tokenId: string, marketName?: string, outcome?: string) {
    this.tokenId = tokenId;
    this.marketName = marketName || "Unknown Market";
    this.outcome = outcome || "Unknown";

    // Create screen - minimal config to avoid conflicts
    this.screen = blessed.screen({
      smartCSR: true,
      title: "Polymarket Strategy Simulator",
      fullUnicode: true,
      warnings: false,
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

    // Market trades panel (top left) - NO mouse, NO input, NO keys
    this.tradesBox = blessed.box({
      top: 3,
      left: 0,
      width: "33%",
      height: "50%-3",
      label: " Market Trades (0) ",
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

    // Simulated trades panel (bottom left)
    this.simulatedTradesBox = blessed.box({
      top: "50%",
      left: 0,
      width: "33%",
      height: "50%",
      label: " Simulated Trades (0) ",
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
          fg: "magenta",
        },
      },
    });

    // Order book panel (top right)
    this.orderBookBox = blessed.box({
      top: 3,
      left: "33%",
      width: "67%",
      height: "50%-3",
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

    // Portfolio panel (bottom right)
    this.portfolioBox = blessed.box({
      top: "50%",
      left: "33%",
      width: "67%",
      height: "50%",
      label: " Portfolio ",
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

    // Add elements to screen
    this.screen.append(this.statusBar);
    this.screen.append(this.tradesBox);
    this.screen.append(this.simulatedTradesBox);
    this.screen.append(this.orderBookBox);
    this.screen.append(this.portfolioBox);

    // NO MOUSE - NO INPUT - NO KEY HANDLERS ON BOXES
    // Only handle quit at screen level

    // Handle quit keys ONLY at screen level
    this.screen.key(["escape", "q", "Q", "C-c"], () => {
      if (this.isExiting) return;
      this.isExiting = true;
      this.destroy();
      process.exit(0);
    });

    // Initial render
    this.screen.render();
  }

  public update(
    trades: Trade[],
    orderBook: OrderBook,
    connected: boolean,
    simulatedTrades?: SimulatedTrade[],
    portfolio?: PortfolioSnapshot
  ): void {
    try {
      // Update status bar
      this.statusBar.setContent(this.formatStatusBar(connected));

      // Combine real trades and simulated trades for the market trades panel
      const allTrades: Array<Trade & { isSimulated?: boolean }> = [
        ...trades.map((t) => ({ ...t, isSimulated: false })),
        ...(simulatedTrades || []).map((st) => ({
          timestamp: st.timestamp,
          side: st.side,
          price: st.price,
          size: st.size,
          notional: st.notional,
          isSimulated: true,
        })),
      ].sort((a, b) => b.timestamp - a.timestamp);

      // Update market trades panel
      const totalCount = trades.length + (simulatedTrades?.length || 0);
      this.tradesBox.setLabel(` Market Trades (${totalCount}) `);
      this.tradesBox.setContent(this.formatTrades(allTrades));

      // Update simulated trades panel
      if (simulatedTrades) {
        this.simulatedTradesBox.setLabel(
          ` Simulated Trades (${simulatedTrades.length}) `
        );
        this.simulatedTradesBox.setContent(
          this.formatSimulatedTrades(simulatedTrades)
        );
      }

      // Update order book
      this.orderBookBox.setContent(this.formatOrderBook(orderBook));

      // Update portfolio
      if (portfolio) {
        this.portfolioBox.setContent(this.formatPortfolio(portfolio));
      }

      // Render
      try {
        this.screen.render();
      } catch (renderError) {
        // Ignore render errors
      }
    } catch (error) {
      // Silently ignore update errors
    }
  }

  public destroy(): void {
    if (this.isExiting) return;
    this.isExiting = true;
    
    try {
      // Reset terminal state
      if (this.screen.program && this.screen.program.output) {
        this.screen.program.output.write("\x1b[?25h"); // Show cursor
        this.screen.program.output.write("\x1b[0m"); // Reset colors
        this.screen.program.output.write("\x1bc"); // Reset terminal
      }
      
      this.screen.destroy();
    } catch (error) {
      try {
        process.stdout.write("\x1b[?25h\x1b[0m\x1bc");
      } catch (e) {
        // Final attempt failed
      }
    }
  }

  private formatStatusBar(connected: boolean): string {
    const status = connected
      ? "{green-fg}● Connected{/green-fg}"
      : "{red-fg}● Disconnected{/red-fg}";

    const maxNameLen = 30;
    const displayName =
      this.marketName.length > maxNameLen
        ? this.marketName.substring(0, maxNameLen - 3) + "..."
        : this.marketName;

    const now = new Date().toLocaleTimeString();

    return `  ${status}  |  {bold}${displayName}{/bold}  |  {cyan-fg}${this.outcome}{/cyan-fg}  |  {gray-fg}${now}{/gray-fg}  |  Press {bold}q{/bold} to quit`;
  }

  private formatTrades(
    trades: Array<Trade & { isSimulated?: boolean }>
  ): string {
    if (trades.length === 0) {
      const now = new Date().toLocaleTimeString();
      return `\n  {gray-fg}Waiting for trades... (${now}){/gray-fg}\n\n  {yellow-fg}💡 Tip: Trades appear when orders match. The order book\n     updates frequently, but trades may be less common.{/yellow-fg}\n\n  {cyan-fg}Try a high-volume market for more activity:{/cyan-fg}\n  {gray-fg}npm run find-tokens{/gray-fg}`;
    }

    const header =
      "  {bold}Time          Side    Price      Size        Value (USDC){/bold}\n" +
      "  ───────────────────────────────────────────────────────────────\n";

    const rows = trades.slice(0, 50).map((trade) => {
      const time = new Date(trade.timestamp).toLocaleTimeString();
      const prefix = trade.isSimulated ? "{magenta-fg}S-{/magenta-fg}" : "   ";
      const side =
        trade.side === "BUY"
          ? "{green-fg}BUY {/green-fg}"
          : "{red-fg}SELL{/red-fg}";
      const price = trade.price.toFixed(4).padStart(8);
      const size = trade.size.toFixed(2).padStart(10);
      const notional = trade.notional.toFixed(2).padStart(12);

      return `  ${time}  ${prefix}${side}  ${price}  ${size}  ${notional}`;
    });

    return header + rows.join("\n");
  }

  private formatOrderBook(orderBook: OrderBook): string {
    if (orderBook.bids.length === 0 && orderBook.asks.length === 0) {
      return "\n  {gray-fg}Waiting for order book...{/gray-fg}";
    }

    const maxLevels = 30;

    const sortedAsks = [...orderBook.asks].sort((a, b) => a.price - b.price);
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

  private formatSimulatedTrades(trades: SimulatedTrade[]): string {
    if (trades.length === 0) {
      return "\n  {gray-fg}No simulated trades yet...{/gray-fg}\n\n  {yellow-fg}💡 Simulated trades will appear here when your\n     strategy executes.{/yellow-fg}";
    }

    const header =
      "  {bold}Time          Strategy      Side    Price      Size        Value{/bold}\n" +
      "  ──────────────────────────────────────────────────────────────────────\n";

    const rows = trades.slice(0, 30).map((trade) => {
      const time = new Date(trade.timestamp).toLocaleTimeString();
      const strategy = trade.strategyName.substring(0, 12).padEnd(12);
      const side =
        trade.side === "BUY"
          ? "{green-fg}BUY {/green-fg}"
          : "{red-fg}SELL{/red-fg}";
      const price = trade.price.toFixed(4).padStart(8);
      const size = trade.size.toFixed(2).padStart(10);
      const notional = trade.notional.toFixed(2).padStart(12);

      return `  ${time}  ${strategy}  ${side}  ${price}  ${size}  ${notional}`;
    });

    return header + rows.join("\n");
  }

  private formatPortfolio(portfolio: PortfolioSnapshot): string {
    const header =
      "  {bold}Portfolio Summary{/bold}\n" +
      "  ──────────────────────────────────────────────────────────────────────\n\n";

    const totalCost = portfolio.totalCost.toFixed(2);
    const currentValue = portfolio.currentValue.toFixed(2);
    const unrealizedPnL = portfolio.unrealizedPnL;
    const realizedPnL = portfolio.realizedPnL;
    const totalPnL = unrealizedPnL + realizedPnL;
    const pnlColor = totalPnL >= 0 ? "green" : "red";
    const pnlPercent =
      portfolio.totalCost > 0
        ? ((totalPnL / portfolio.totalCost) * 100).toFixed(2)
        : "0.00";

    let summary = `  {bold}Total Cost:        {/bold}${totalCost.padStart(15)} USDC\n`;
    summary += `  {bold}Current Value:     {/bold}${currentValue.padStart(15)} USDC\n`;
    summary += `  {bold}Unrealized P&L:    {/bold}{${pnlColor}-fg}${unrealizedPnL.toFixed(2).padStart(15)}{/} USDC\n`;
    summary += `  {bold}Realized P&L:      {/bold}{${pnlColor}-fg}${realizedPnL.toFixed(2).padStart(15)}{/} USDC\n`;
    summary += `  {bold}Total P&L:         {/bold}{${pnlColor}-fg}${totalPnL.toFixed(2).padStart(15)} USDC (${pnlPercent}%){/}\n\n`;

    if (portfolio.positions.length > 0) {
      summary +=
        "  {bold}Positions:{/bold}\n" +
        "  ──────────────────────────────────────────────────────────────────────\n";
      summary +=
        "  {bold}Outcome        Shares      Avg Price    Cost        Value       P&L{/bold}\n";
      summary +=
        "  ──────────────────────────────────────────────────────────────────────\n";

      const totalShares = portfolio.positions.reduce((sum, p) => sum + p.shares, 0);
      const currentPrice = totalShares > 0 ? portfolio.currentValue / totalShares : 0.5;

      for (const position of portfolio.positions) {
        const positionValue = currentPrice * position.shares;
        const positionPnL = positionValue - position.totalCost;
        const pnlColor = positionPnL >= 0 ? "green" : "red";

        const outcome = position.outcome.substring(0, 12).padEnd(12);
        const shares = position.shares.toFixed(2).padStart(10);
        const avgPrice = position.averagePrice.toFixed(4).padStart(10);
        const cost = position.totalCost.toFixed(2).padStart(10);
        const value = positionValue.toFixed(2).padStart(10);
        const pnl = `${positionPnL >= 0 ? "+" : ""}${positionPnL.toFixed(2)}`.padStart(10);

        summary += `  ${outcome}  ${shares}  ${avgPrice}  ${cost}  ${value}  {${pnlColor}-fg}${pnl}{/}\n`;
      }
    } else {
      summary += "  {gray-fg}No positions yet...{/gray-fg}\n";
    }

    return header + summary;
  }
}

