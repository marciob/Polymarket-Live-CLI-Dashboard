#!/usr/bin/env node

import https from "https";
import { PolymarketWebSocketClient } from "./websocket/client";
import { DashboardUI } from "./ui/renderer";
import { Trade, OrderBook } from "./types";

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
        } else {
          resolve(data);
        }
      });
    }).on("error", reject);
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
    if (event.markets && Array.isArray(event.markets) && event.markets.length > 0) {
      return event.markets;
    }
    
    // Event found but no markets
    throw new Error(`Event found but has no markets. Market may not be ready yet.`);
  } catch (error) {
    const eventError = error instanceof Error ? error : new Error(String(error));
    
    // If both failed, show the most helpful error
    if (lastError && eventError.message.includes("Event found")) {
      throw eventError;
    }
    
    throw new Error(`Could not find market or event with slug: ${slug}. ${eventError.message}`);
  }
}

function parseTokenData(market: any): Array<{ token_id: string; outcome: string; price: number }> {
  const tokens: Array<{ token_id: string; outcome: string; price: number }> = [];
  
  try {
    const tokenIds: string[] = typeof market.clobTokenIds === 'string' 
      ? JSON.parse(market.clobTokenIds) 
      : (market.clobTokenIds || []);
    
    const outcomes: string[] = typeof market.outcomes === 'string'
      ? JSON.parse(market.outcomes)
      : (market.outcomes || []);
    
    const prices: string[] = typeof market.outcomePrices === 'string'
      ? JSON.parse(market.outcomePrices)
      : (market.outcomePrices || []);
    
    for (let i = 0; i < tokenIds.length; i++) {
      tokens.push({
        token_id: tokenIds[i],
        outcome: outcomes[i] || `Outcome ${i + 1}`,
        price: prices[i] ? parseFloat(prices[i]) : 0
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
): Promise<{ tokenId: string; marketName: string; outcome: string; allTokens: Array<{ token_id: string; outcome: string; price: number }> }> {
  const slug = extractSlug(input);
  
  if (!slug) {
    // It's already a token ID
    return { 
      tokenId: input, 
      marketName: "Unknown", 
      outcome: "Unknown",
      allTokens: []
    };
  }
  
  try {
    const markets = await fetchMarketsBySlug(slug);
    
    if (!markets || markets.length === 0) {
      throw new Error(`No markets found for slug: ${slug}. The market may be closed or the slug may be incorrect.`);
    }
    
    const market = markets[0];
    const tokens = parseTokenData(market);
    
    if (tokens.length === 0) {
      throw new Error(`No tokens found in market. Market may not be ready yet. Try: npm run get-tokens "${slug}"`);
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
          (t) => t.outcome.toLowerCase().includes(lowerSelector) ||
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
      allTokens: tokens
    };
    
  } catch (error) {
    throw new Error(`Failed to fetch market: ${error instanceof Error ? error.message : error}`);
  }
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

  try {
    // Try to resolve as URL/slug first, or use as token ID
    const resolved = await resolveTokenId(input, outcomeSelector);
    tokenId = resolved.tokenId;
    marketName = resolved.marketName;
    outcome = resolved.outcome;
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
        console.error('   npm start -- "https://polymarket.com/event/your-market"\n');
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
      console.error("2. Verify the market exists at: https://polymarket.com/markets");
      console.error("3. Try searching: npm run find-tokens <search_term>");
      console.error("4. Or get tokens directly: npm run get-tokens \"your-market-slug\"\n");
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
      console.error('   npm start -- "https://polymarket.com/event/your-market"\n');
      process.exit(1);
    }

    tokenId = input;
  }

  // Initialize WebSocket client

  // Initialize UI
  let ui: DashboardUI | null = null;

  const wsClient = new PolymarketWebSocketClient(
    tokenId,
    (trades: Trade[], orderBook: OrderBook, connected: boolean) => {
      if (!ui) {
        // Create UI on first message
        ui = new DashboardUI(tokenId, marketName, outcome);
      }
      ui.update(trades, orderBook, connected);
    }
  );

  // Handle process termination
  const cleanup = (): void => {
    if (ui) {
      ui.destroy();
    }
    wsClient.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Connect to WebSocket
  wsClient.connect();
}

// Run
main().catch((error) => {
  console.error("\n❌ Fatal error:", error.message);
  process.exit(1);
});

