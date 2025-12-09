/**
 * Clean, composable dashboard UI
 */

import blessed from "blessed";
import { Trade, OrderBook } from "../types";
import { SimulatedTrade } from "../strategy/types";
import { PortfolioSnapshot } from "../portfolio/types";
import { formatStatusBar } from "./formatters/status-bar";
import { formatMarketTrades, DisplayTrade } from "./formatters/trades";
import { formatSimulatedTrades } from "./formatters/simulated-trades";
import { formatOrderBook } from "./formatters/order-book";
import { formatPortfolio } from "./formatters/portfolio";
import { KeyboardHandler } from "./keyboard-handler";
import * as BoxConfigs from "./components/box-configs";

export class DashboardUI {
  private screen: blessed.Widgets.Screen;
  private statusBar: blessed.Widgets.BoxElement;
  private tradesBox: blessed.Widgets.BoxElement;
  private simulatedTradesBox: blessed.Widgets.BoxElement;
  private orderBookBox: blessed.Widgets.BoxElement;
  private portfolioBox: blessed.Widgets.BoxElement;
  private keyboardHandler: KeyboardHandler;
  private isExiting: boolean = false;

  constructor(
    private tokenId: string,
    private marketName: string,
    private outcome: string
  ) {
    this.screen = this.createScreen();
    this.statusBar = BoxConfigs.createStatusBar();
    this.tradesBox = BoxConfigs.createTradesBox();
    this.simulatedTradesBox = BoxConfigs.createSimulatedTradesBox();
    this.orderBookBox = BoxConfigs.createOrderBookBox();
    this.portfolioBox = BoxConfigs.createPortfolioBox();

    this.appendBoxesToScreen();
    this.setupKeyboard();
    this.screen.render();
  }

  private createScreen(): blessed.Widgets.Screen {
    return blessed.screen({
      smartCSR: true,
      title: "Polymarket Strategy Simulator",
      fullUnicode: true,
      warnings: false,
    });
  }

  private appendBoxesToScreen(): void {
    this.screen.append(this.statusBar);
    this.screen.append(this.tradesBox);
    this.screen.append(this.simulatedTradesBox);
    this.screen.append(this.orderBookBox);
    this.screen.append(this.portfolioBox);
  }

  private setupKeyboard(): void {
    const scrollableBoxes = [
      { box: this.tradesBox, label: "Market Trades" },
      { box: this.simulatedTradesBox, label: "Simulated Trades" },
      { box: this.orderBookBox, label: "Order Book" },
    ];

    this.keyboardHandler = new KeyboardHandler(
      this.screen,
      scrollableBoxes,
      () => this.handleExit()
    );
  }

  private handleExit(): void {
    if (this.isExiting) return;
    this.isExiting = true;
    this.destroy();
    process.exit(0);
  }

  public update(
    trades: Trade[],
    orderBook: OrderBook,
    connected: boolean,
    simulatedTrades?: SimulatedTrade[],
    portfolio?: PortfolioSnapshot
  ): void {
    try {
      this.updateStatusBar(connected);
      this.updateTradesPanel(trades, simulatedTrades);
      this.updateSimulatedTradesPanel(simulatedTrades);
      this.updateOrderBookPanel(orderBook);
      this.updatePortfolioPanel(portfolio);
      this.render();
    } catch (error) {
      // Silently ignore update errors
    }
  }

  private updateStatusBar(connected: boolean): void {
    const content = formatStatusBar(connected, this.marketName, this.outcome);
    this.statusBar.setContent(content);
  }

  private updateTradesPanel(
    trades: Trade[],
    simulatedTrades?: SimulatedTrade[]
  ): void {
    const allTrades = this.combineTradesForDisplay(trades, simulatedTrades);
    const totalCount = trades.length + (simulatedTrades?.length || 0);

    this.tradesBox.setLabel(` Market Trades (${totalCount}) `);
    this.tradesBox.setContent(formatMarketTrades(allTrades));
  }

  private combineTradesForDisplay(
    trades: Trade[],
    simulatedTrades?: SimulatedTrade[]
  ): DisplayTrade[] {
    const allTrades: DisplayTrade[] = [
      ...trades.map((t) => ({ ...t, isSimulated: false })),
      ...(simulatedTrades || []).map((st) => ({
        timestamp: st.timestamp,
        side: st.side,
        price: st.price,
        size: st.size,
        notional: st.notional,
        isSimulated: true,
      })),
    ];

    return allTrades.sort((a, b) => b.timestamp - a.timestamp);
  }

  private updateSimulatedTradesPanel(simulatedTrades?: SimulatedTrade[]): void {
    if (simulatedTrades) {
      this.simulatedTradesBox.setLabel(
        ` Simulated Trades (${simulatedTrades.length}) `
      );
      this.simulatedTradesBox.setContent(
        formatSimulatedTrades(simulatedTrades)
      );
    }
  }

  private updateOrderBookPanel(orderBook: OrderBook): void {
    this.orderBookBox.setContent(formatOrderBook(orderBook));
  }

  private updatePortfolioPanel(portfolio?: PortfolioSnapshot): void {
    if (portfolio) {
      this.portfolioBox.setContent(formatPortfolio(portfolio));
    }
  }

  private render(): void {
    try {
      this.screen.render();
    } catch (renderError) {
      // Ignore render errors
    }
  }

  public destroy(): void {
    if (this.isExiting) return;
    this.isExiting = true;

    this.resetTerminal();
    this.screen.destroy();
  }

  private resetTerminal(): void {
    try {
      if (this.screen.program?.output) {
        this.screen.program.output.write("\x1b[?25h"); // Show cursor
        this.screen.program.output.write("\x1b[0m"); // Reset colors
        this.screen.program.output.write("\x1bc"); // Reset terminal
      }
    } catch (error) {
      try {
        process.stdout.write("\x1b[?25h\x1b[0m\x1bc");
      } catch (e) {
        // Final fallback failed
      }
    }
  }
}

