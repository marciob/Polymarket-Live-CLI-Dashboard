#!/usr/bin/env ts-node

/**
 * Get the current 15-minute crypto market
 * These markets are highly volatile and perfect for testing live trades
 * 
 * Usage:
 *   npm run get-15min btc
 *   npm run get-15min eth
 *   npm run get-15min sol
 *   npm run get-15min xrp
 */

import https from "https";

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
    // Return empty if parsing fails
  }
  
  return tokens;
}

function getNext15MinTimestamp(): number {
  const now = new Date();
  const minutes = now.getMinutes();
  
  // Round down to nearest 15-minute mark
  const roundedMinutes = Math.floor(minutes / 15) * 15;
  
  const next15 = new Date(now);
  next15.setMinutes(roundedMinutes, 0, 0);
  
  return Math.floor(next15.getTime() / 1000);
}

function getPrevious15MinTimestamp(): number {
  const now = new Date();
  const minutes = now.getMinutes();
  
  // Round down to previous 15-minute mark
  const roundedMinutes = Math.floor(minutes / 15) * 15;
  
  const prev15 = new Date(now);
  prev15.setMinutes(roundedMinutes - 15, 0, 0);
  
  return Math.floor(prev15.getTime() / 1000);
}

async function fetchMarketBySlug(slug: string): Promise<any> {
  const url = `https://gamma-api.polymarket.com/markets?slug=${slug}`;
  const data = await httpsGet(url);
  const markets = JSON.parse(data);
  return markets.length > 0 ? markets[0] : null;
}

async function main(): Promise<void> {
  const crypto = (process.argv[2] || "btc").toLowerCase();
  
  const validCryptos = ["btc", "eth", "sol", "xrp"];
  if (!validCryptos.includes(crypto)) {
    console.log(`\n❌ Invalid crypto. Choose from: ${validCryptos.join(", ")}\n`);
    process.exit(1);
  }

  console.log(`\n🔍 Finding current 15-minute ${crypto.toUpperCase()} market...\n`);

  // Try current and previous 15-minute windows
  const timestamps = [
    getNext15MinTimestamp(),
    getPrevious15MinTimestamp(),
    getNext15MinTimestamp() + 900, // +15 min
  ];

  let market = null;
  let usedTimestamp = 0;

  for (const ts of timestamps) {
    const slug = `${crypto}-updown-15m-${ts}`;
    const date = new Date(ts * 1000);
    
    console.log(`   Trying: ${slug}`);
    console.log(`   Time window: ${date.toLocaleTimeString()}`);
    
    try {
      market = await fetchMarketBySlug(slug);
      if (market) {
        usedTimestamp = ts;
        console.log(`   ✅ Found!\n`);
        break;
      }
    } catch (error) {
      // Try next timestamp
    }
    
    console.log(`   ❌ Not found\n`);
  }

  if (!market) {
    console.log("❌ Could not find an active 15-minute market.\n");
    console.log("These markets are created dynamically every 15 minutes.");
    console.log("Try again in a few minutes, or use a daily market:\n");
    console.log(`   npm run get-tokens "${crypto}-up-or-down-on-december-8"\n`);
    process.exit(1);
  }

  console.log("═".repeat(80));
  console.log(`\n📊 ${market.question}\n`);
  console.log("─".repeat(80));
  
  const windowStart = new Date(usedTimestamp * 1000);
  const windowEnd = new Date((usedTimestamp + 900) * 1000);
  
  console.log(`Window: ${windowStart.toLocaleTimeString()} - ${windowEnd.toLocaleTimeString()}`);
  console.log(`Volume: $${parseFloat(market.volume || 0).toLocaleString()}`);
  console.log(`Active: ${market.active ? "Yes" : "No"}`);
  console.log(`Slug: ${market.slug}`);
  
  console.log("\n" + "─".repeat(80));
  console.log("\n🎯 TOKENS:\n");

  const tokens = parseTokenData(market);

  if (tokens.length === 0) {
    console.log("❌ No tokens found.\n");
    process.exit(1);
  }

  tokens.forEach((token, index) => {
    const outcomeLabel = token.outcome.padEnd(15);
    const price = token.price 
      ? `${(token.price * 100).toFixed(1)}%`.padStart(8)
      : "N/A     ";
    
    console.log(`${index + 1}. Outcome: ${outcomeLabel} Price: ${price}`);
    console.log(`   Token ID: ${token.token_id}\n`);
  });

  console.log("─".repeat(80));
  console.log("\n💻 MONITOR THIS MARKET:\n");
  console.log(`   npm start -- ${tokens[0].token_id}\n`);
  console.log("═".repeat(80));
  
  console.log("\n🔥 15-MINUTE MARKETS ARE HIGHLY VOLATILE!");
  console.log("   Expect frequent trades and rapid price changes.\n");
  console.log("   ⏱️  Market resolves at: " + windowEnd.toLocaleTimeString());
  console.log("   📊 Perfect for testing the live dashboard!\n");
}

main();

