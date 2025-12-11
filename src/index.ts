#!/usr/bin/env node

// src/index.ts
import https from "https";
import * as readline from "readline";
import blessed from "blessed";
import { PolymarketWebSocketClient } from "./websocket/client";
import { DashboardUI } from "./ui/renderer";
import { Trade, OrderBook } from "./types";
import { StrategySimulator } from "./simulator/simulator";
import { PollBuyStrategy } from "./strategy/poll-buy-strategy";

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
          } else {
            resolve(data);
          }
        });
      })
      .on("error", reject);
  });
}

async function fetchMarketsBySlug(slug: string): Promise<any[]> {
  let lastError: Error | null = null;

  // Try markets endpoint first
  try {
    const url = `https://gamma-api.polymarket.com/markets?slug=${slug}&closed=false`;
    const data = await httpsGet(url);
    const markets = JSON.parse(data);
    if (markets && Array.isArray(markets) && markets.length > 0) {
      return markets;
    }
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
    // Fall through to try events endpoint
  }

  // Try events endpoint (for event slugs)
  try {
    const eventUrl = `https://gamma-api.polymarket.com/events/slug/${slug}`;
    const eventData = await httpsGet(eventUrl);
    const event = JSON.parse(eventData);

    // If event has markets array, return those
    if (
      event.markets &&
      Array.isArray(event.markets) &&
      event.markets.length > 0
    ) {
      return event.markets;
    }

    // Event found but no markets
    throw new Error(
      `Event found but has no markets. Market may not be ready yet.`
    );
  } catch (error) {
    const eventError =
      error instanceof Error ? error : new Error(String(error));

    // If both failed, show the most helpful error
    if (lastError && eventError.message.includes("Event found")) {
      throw eventError;
    }

    throw new Error(
      `Could not find market or event with slug: ${slug}. ${eventError.message}`
    );
  }
}

function parseTokenData(
  market: any
): Array<{ token_id: string; outcome: string; price: number }> {
  const tokens: Array<{ token_id: string; outcome: string; price: number }> =
    [];

  try {
    const tokenIds: string[] =
      typeof market.clobTokenIds === "string"
        ? JSON.parse(market.clobTokenIds)
        : market.clobTokenIds || [];

    const outcomes: string[] =
      typeof market.outcomes === "string"
        ? JSON.parse(market.outcomes)
        : market.outcomes || [];

    const prices: string[] =
      typeof market.outcomePrices === "string"
        ? JSON.parse(market.outcomePrices)
        : market.outcomePrices || [];

    for (let i = 0; i < tokenIds.length; i++) {
      tokens.push({
        token_id: tokenIds[i],
        outcome: outcomes[i] || `Outcome ${i + 1}`,
        price: prices[i] ? parseFloat(prices[i]) : 0,
      });
    }
  } catch (error) {
    // Return empty on error
  }

  return tokens;
}

function extractSlug(input: string): string | null {
  // If it's a URL, extract the slug
  if (input.includes("polymarket.com")) {
    const match = input.match(/event\/([^?#]+)/);
    if (match) {
      return match[1];
    }
  }
  // If it looks like a slug (contains dashes, not all digits)
  if (input.includes("-") && !/^\d+$/.test(input)) {
    return input.replace(/^\/+|\/+$/g, "");
  }
  return null;
}

async function resolveTokenId(
  input: string,
  outcomeSelector?: string
): Promise<{
  tokenId: string;
  marketName: string;
  outcome: string;
  allTokens: Array<{ token_id: string; outcome: string; price: number }>;
}> {
  const slug = extractSlug(input);

  if (!slug) {
    // It's already a token ID
    return {
      tokenId: input,
      marketName: "Unknown",
      outcome: "Unknown",
      allTokens: [],
    };
  }

  try {
    const markets = await fetchMarketsBySlug(slug);

    if (!markets || markets.length === 0) {
      throw new Error(
        `No markets found for slug: ${slug}. The market may be closed or the slug may be incorrect.`
      );
    }

    const market = markets[0];
    const tokens = parseTokenData(market);

    if (tokens.length === 0) {
      throw new Error(
        `No tokens found in market. Market may not be ready yet. Try: npm run get-tokens "${slug}"`
      );
    }

    // Try to match outcome selector
    let selectedToken = tokens[0];
    let selectedIndex = 0;

    if (outcomeSelector) {
      // Try to match by index (1-based)
      const index = parseInt(outcomeSelector);
      if (!isNaN(index) && index >= 1 && index <= tokens.length) {
        selectedToken = tokens[index - 1];
        selectedIndex = index - 1;
      } else {
        // Try to match by name (case-insensitive, partial match)
        const lowerSelector = outcomeSelector.toLowerCase();
        const matchIndex = tokens.findIndex(
          (t) =>
            t.outcome.toLowerCase().includes(lowerSelector) ||
            lowerSelector.includes(t.outcome.toLowerCase())
        );
        if (matchIndex !== -1) {
          selectedToken = tokens[matchIndex];
          selectedIndex = matchIndex;
        }
      }
    }

    return {
      tokenId: selectedToken.token_id,
      marketName: market.question || slug,
      outcome: selectedToken.outcome,
      allTokens: tokens,
    };
  } catch (error) {
    throw new Error(
      `Failed to fetch market: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
}

/**
 * Fetch current market prices for tokens using CLOB API
 * Uses multiple endpoints to get the best ask price (buy price) for accurate buying costs
 */
async function fetchCurrentPrices(
  tokens: Array<{ token_id: string; outcome: string; price: number }>
): Promise<Array<{ token_id: string; outcome: string; price: number }>> {
  const CLOB_BASE_URL = "https://clob.polymarket.com";

  // Try to fetch all prices at once using the /prices endpoint (if it supports multiple tokens)
  // Otherwise, fetch individually
  if (tokens.length === 0) {
    return tokens;
  }

  // Fetch prices for all tokens in parallel using individual requests
  const pricePromises = tokens.map(async (token) => {
    let currentPrice = 0;

    // Strategy 1: Try /book endpoint to get order book and extract best ask
    try {
      const bookUrl = `${CLOB_BASE_URL}/book?token_id=${token.token_id}`;
      const bookData = await httpsGet(bookUrl);
      const bookResponse = JSON.parse(bookData);

      // Check if we got an order book (not an error)
      if (bookResponse.asks || bookResponse.sells) {
        const asks = bookResponse.asks || bookResponse.sells || [];

        if (Array.isArray(asks) && asks.length > 0) {
          // Extract prices from asks
          const askPrices = asks
            .map((ask: any) => {
              if (Array.isArray(ask)) {
                return parseFloat(String(ask[0] || "0"));
              } else if (ask && typeof ask === "object") {
                return parseFloat(String(ask.price || "0"));
              }
              return 0;
            })
            .filter((p: number) => p > 0 && p <= 1);

          if (askPrices.length > 0) {
            currentPrice = Math.min(...askPrices);
          }
        }
      }
    } catch (bookError) {
      // Continue to next strategy
    }

    // Strategy 2: If book didn't work, try /price endpoint with side=BUY
    if (currentPrice <= 0) {
      try {
        const priceUrl = `${CLOB_BASE_URL}/price?token_id=${token.token_id}&side=BUY`;
        const priceData = await httpsGet(priceUrl);
        const priceResponse = JSON.parse(priceData);

        // Response might be { price: "0.52" } or { bestAsk: "0.52" } or similar
        const price =
          priceResponse.price || priceResponse.bestAsk || priceResponse.ask;
        if (price) {
          currentPrice = parseFloat(String(price));
        }
      } catch (priceError) {
        // Continue to next strategy
      }
    }

    // Strategy 3: Fallback to midpoint
    if (currentPrice <= 0) {
      try {
        const midpointUrl = `${CLOB_BASE_URL}/midpoint?token_id=${token.token_id}`;
        const midpointData = await httpsGet(midpointUrl);
        const midpointResponse = JSON.parse(midpointData);
        const midpointPrice = midpointResponse.price
          ? parseFloat(String(midpointResponse.price))
          : 0;

        if (midpointPrice > 0 && midpointPrice <= 1) {
          currentPrice = midpointPrice;
        }
      } catch (midpointError) {
        // Use original price as last resort
      }
    }

    return {
      ...token,
      price: currentPrice > 0 && currentPrice <= 1 ? currentPrice : token.price,
    };
  });

  return Promise.all(pricePromises);
}

/**
 * Prompt user to choose which outcome to buy using interactive menu
 */
async function promptOutcomeChoice(
  tokens: Array<{ token_id: string; outcome: string; price: number }>
): Promise<{ tokenId: string; outcome: string }> {
  // Fetch current prices before displaying
  console.log("\n⏳ Fetching current market prices...");
  const tokensWithPrices = await fetchCurrentPrices(tokens);

  return new Promise((resolve) => {
    // Create a temporary screen for the selection menu
    const screen = blessed.screen({
      smartCSR: true,
      fullUnicode: true,
      warnings: false,
    });

    // Create a box for the title
    const titleBox = blessed.box({
      top: 1,
      left: "center",
      width: "shrink",
      height: 1,
      content: "📊 Select outcome to buy",
      style: {
        fg: "white",
        bold: true,
      },
    });

    // Create list items with prices
    const items = tokensWithPrices.map((token, index) => {
      const price = token.price > 0 ? `$${token.price.toFixed(4)}` : "N/A";
      return `${token.outcome.padEnd(20)} ${price}`;
    });

    // Calculate list height
    const listHeight = Math.min(items.length + 2, 15);

    // Create the list
    const list = blessed.list({
      top: 3,
      left: "center",
      width: 50,
      height: listHeight,
      keys: true,
      vi: true,
      mouse: true,
      items: items,
      style: {
        selected: {
          bg: "blue",
          fg: "white",
          bold: true,
        },
        item: {
          fg: "white",
        },
      },
      border: {
        type: "line",
      },
    });

    // Add instructions
    const instructions = blessed.box({
      top: 3 + listHeight + 1,
      left: "center",
      width: "shrink",
      height: 3,
      content: "↑/↓: Navigate  |  Enter: Select  |  q/ESC: Cancel",
      style: {
        fg: "gray",
      },
    });

    // Handle selection
    list.on("select", (item: any, index: number) => {
      const selected = tokensWithPrices[index];
      screen.destroy();
      console.log(`\n✅ Selected: ${selected.outcome}\n`);
      resolve({
        tokenId: selected.token_id,
        outcome: selected.outcome,
      });
    });

    // Handle cancel (q or ESC)
    list.key(["q", "escape"], () => {
      screen.destroy();
      // Default to first token on cancel
      const selected = tokensWithPrices[0];
      console.log(`\n⚠️  Cancelled, defaulting to: ${selected.outcome}\n`);
      resolve({
        tokenId: selected.token_id,
        outcome: selected.outcome,
      });
    });

    // Append to screen
    screen.append(titleBox);
    screen.append(list);
    screen.append(instructions);

    // Focus the list
    list.focus();

    // Render
    screen.render();

    // Handle screen exit
    screen.key(["q", "escape", "C-c"], () => {
      screen.destroy();
      const selected = tokensWithPrices[0];
      console.log(`\n⚠️  Cancelled, defaulting to: ${selected.outcome}\n`);
      resolve({
        tokenId: selected.token_id,
        outcome: selected.outcome,
      });
    });
  });
}

function printUsage(): void {
  console.log(`
Polymarket Live Dashboard
═════════════════════════

Usage:
  npm start -- <url_or_token_id>
  npm run dev <url_or_token_id>

Examples:
  # Paste a Polymarket URL directly! 🎉
  npm start -- "https://polymarket.com/event/bitcoin-up-or-down-on-december-8"
  
  # Select specific outcome from multi-outcome markets:
  npm start -- "https://polymarket.com/event/fed-decision-in-december" --outcome "25 bps decrease"
  npm start -- "fed-decision-in-december" --outcome 2  # Select by number (1, 2, 3...)
  
  # Or use a market slug
  npm start -- "bitcoin-up-or-down-on-december-8"
  
  # Or use a token ID directly
  npm start -- 71321045679252212594626385532706912750332728571942532289631379312455583992563

🔥 For high-frequency trading action:
  npm run get-15min btc    # Get current 15-minute BTC market
  npm start -- <token_id>  # Then monitor it

How to find markets:

  Method 1 - Current 15-min crypto markets (most active!):
    npm run get-15min btc
    npm run get-15min eth
    npm run get-15min sol
    
  Method 2 - From any market URL:
    npm run get-tokens "https://polymarket.com/event/your-market"
    
  Method 3 - Search markets:
    npm run find-tokens              # Show top markets
    npm run find-tokens bitcoin      # Search for "bitcoin"

Features:
  - Real-time order book updates
  - Live trade feed
  - Auto-reconnection on disconnect
  - WebSocket keepalive (PING/PONG)
  - Auto-fetch tokens from URLs 🆕

Controls:
  q, ESC, Ctrl+C  - Quit

Documentation:
  https://docs.polymarket.com/developers/CLOB/websocket/market-channel
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Validate arguments
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  // Parse arguments for --outcome flag
  let input = args[0];
  let outcomeSelector: string | undefined;

  const outcomeIndex = args.indexOf("--outcome");
  if (outcomeIndex !== -1 && outcomeIndex + 1 < args.length) {
    outcomeSelector = args[outcomeIndex + 1];
  }

  let tokenId: string;
  let marketName = "Unknown Market";
  let outcome = "Unknown";
  let allTokens: Array<{ token_id: string; outcome: string; price: number }> =
    [];

  try {
    // Try to resolve as URL/slug first, or use as token ID
    const resolved = await resolveTokenId(input, outcomeSelector);
    tokenId = resolved.tokenId;
    marketName = resolved.marketName;
    outcome = resolved.outcome;
    allTokens = resolved.allTokens;
  } catch (error) {
    // Show the actual error message first
    const errorMessage = error instanceof Error ? error.message : String(error);

    // If it's already a token ID (all digits), validate it
    if (/^\d+$/.test(input)) {
      if (input.length < 70) {
        console.error("\n❌ Error: Token ID too short.");
        console.error(`   You provided: ${input} (${input.length} digits)`);
        console.error("   Valid token IDs are 77-78 digits long.\n");

        if (input.length < 15) {
          console.error("   ⚠️  It looks like you used the 'tid' from a URL.");
          console.error("      The 'tid' parameter is NOT a token ID!\n");
        }

        console.error("   Try pasting the full URL instead:");
        console.error(
          '   npm start -- "https://polymarket.com/event/your-market"\n'
        );
        process.exit(1);
      }
      // Valid token ID format, use it directly
      tokenId = input;
    } else {
      // Not a token ID, show the actual API error
      console.error("\n❌ Error fetching market:");
      console.error(`   ${errorMessage}\n`);

      console.error("Troubleshooting:");
      console.error("1. Check that the URL/slug is correct");
      console.error(
        "2. Verify the market exists at: https://polymarket.com/markets"
      );
      console.error("3. Try searching: npm run find-tokens <search_term>");
      console.error(
        '4. Or get tokens directly: npm run get-tokens "your-market-slug"\n'
      );
      process.exit(1);
    }

    if (input.length < 70) {
      console.error("\n❌ Error: Token ID too short.");
      console.error(`   You provided: ${input} (${input.length} digits)`);
      console.error("   Valid token IDs are 77-78 digits long.\n");

      if (input.length < 15) {
        console.error("   ⚠️  It looks like you used the 'tid' from a URL.");
        console.error("      The 'tid' parameter is NOT a token ID!\n");
      }

      console.error("   Try pasting the full URL instead:");
      console.error(
        '   npm start -- "https://polymarket.com/event/your-market"\n'
      );
      process.exit(1);
    }

    tokenId = input;
  }

  // Prompt user to choose which outcome to buy (if we have multiple tokens)
  let selectedTokenId = tokenId;
  let selectedOutcome = outcome;

  if (allTokens.length > 1) {
    if (outcomeSelector) {
      // Outcome already selected via --outcome, so don't prompt interactively.
      // Fetch current price for the selected token to display confirmation.
      console.log("\n⏳ Fetching current market price...");
      const [selectedToken] = await fetchCurrentPrices([
        { token_id: tokenId, outcome, price: 0 },
      ]);
      const priceDisplay =
        selectedToken && selectedToken.price > 0
          ? ` at $${selectedToken.price.toFixed(4)}`
          : "";
      console.log(`\n✅ Strategy will buy: ${outcome}${priceDisplay}\n`);
    } else {
      // Multiple tokens available - prompt user to choose
      const choice = await promptOutcomeChoice(allTokens);
      selectedTokenId = choice.tokenId;
      selectedOutcome = choice.outcome;
    }
  } else if (allTokens.length === 1) {
    // Only one token, fetch current price and use it
    console.log("\n⏳ Fetching current market price...");
    const tokensWithPrices = await fetchCurrentPrices(allTokens);
    const token = tokensWithPrices[0];
    selectedTokenId = token.token_id;
    selectedOutcome = token.outcome;
    const priceDisplay =
      token.price > 0 ? ` at $${token.price.toFixed(4)}` : "";
    console.log(`\n✅ Strategy will buy: ${selectedOutcome}${priceDisplay}\n`);
  } else {
    // No tokens list (e.g., when using token ID directly)
    // Use the resolved tokenId and outcome
    console.log(`\n✅ Strategy will buy: ${outcome}\n`);
  }

  // Update tokenId and outcome to the selected ones
  tokenId = selectedTokenId;
  outcome = selectedOutcome;

  // Initialize Strategy Simulator
  const simulator = new StrategySimulator({
    evaluationIntervalMs: 1000, // Evaluate strategies every second
  });

  // Add Poll Buy Strategy (buys every 15 seconds)
  const pollBuyStrategy = new PollBuyStrategy({
    name: "PollBuy",
    enabled: true,
    intervalSeconds: 15,
    buySize: 1.0, // Buy 1 share each time
    targetTokenId: selectedTokenId,
    targetOutcome: selectedOutcome,
  });

  simulator.addStrategy(pollBuyStrategy);

  // Initialize WebSocket client
  let ui: DashboardUI | null = null;
  let initialContextCreated = false;

  const wsClient = new PolymarketWebSocketClient(
    tokenId,
    (trades: Trade[], orderBook: OrderBook, connected: boolean) => {
      try {
        if (!ui) {
          // Create UI on first message
          ui = new DashboardUI(tokenId, marketName, outcome);
        }

        // Update simulator with market data
        simulator.updateMarket(tokenId, orderBook);

        // Initialize simulator context on first order book update
        if (
          !initialContextCreated &&
          orderBook.bids.length > 0 &&
          orderBook.asks.length > 0
        ) {
          const bestBid = orderBook.bids[0]?.price || 0;
          const bestAsk = orderBook.asks[0]?.price || 1;
          const currentPrice = bestAsk;

          simulator.start({
            tokenId,
            marketName,
            outcome,
            currentPrice,
            bestBid,
            bestAsk,
            timestamp: Date.now(),
          });

          initialContextCreated = true;
        }

        // Get simulated trades and portfolio
        const simulatedTrades = simulator.getTrades();
        const portfolio = simulator.getPortfolio().getSnapshot();

        // Update UI with all data
        if (ui) {
          ui.update(trades, orderBook, connected, simulatedTrades, portfolio);
        }
      } catch (error) {
        // Log error but don't crash - continue running
        console.error("Error updating UI:", error);
      }
    }
  );

  // Handle process termination
  const cleanup = (): void => {
    simulator.stop();
    if (ui) {
      ui.destroy();
    }
    wsClient.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Handle uncaught errors to prevent crashes
  process.on("uncaughtException", (error) => {
    console.error("\n❌ Uncaught exception:", error.message);
    cleanup();
  });

  process.on("unhandledRejection", (reason) => {
    console.error("\n❌ Unhandled rejection:", reason);
    // Don't exit on unhandled rejection, just log it
  });

  // Connect to WebSocket
  wsClient.connect();
}

// Run
main().catch((error) => {
  console.error("\n❌ Fatal error:", error.message);
  process.exit(1);
});
