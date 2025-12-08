#!/usr/bin/env ts-node

/**
 * Get token IDs from a Polymarket market URL or slug
 * 
 * Usage:
 *   npm run get-tokens <url_or_slug>
 * 
 * Examples:
 *   npm run get-tokens "https://polymarket.com/event/bitcoin-up-or-down-on-december-8"
 *   npm run get-tokens "bitcoin-up-or-down-on-december-8"
 */

import https from "https";

function extractSlug(input: string): string {
  // If it's a URL, extract the slug
  if (input.includes("polymarket.com")) {
    const match = input.match(/event\/([^?#]+)/);
    if (match) {
      return match[1];
    }
  }
  // Otherwise assume it's already a slug
  return input.replace(/^\/+|\/+$/g, "");
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(data);
        }
      });
    }).on("error", reject);
  });
}

async function fetchMarketsBySlug(slug: string): Promise<any[]> {
  const url = `https://gamma-api.polymarket.com/markets?slug=${slug}&closed=false`;
  const data = await httpsGet(url);
  return JSON.parse(data);
}

function parseTokenData(market: any): Array<{ token_id: string; outcome: string; price: number }> {
  const tokens: Array<{ token_id: string; outcome: string; price: number }> = [];
  
  try {
    // Parse clobTokenIds - it's a JSON string
    const tokenIds: string[] = typeof market.clobTokenIds === 'string' 
      ? JSON.parse(market.clobTokenIds) 
      : (market.clobTokenIds || []);
    
    // Parse outcomes - it's also a JSON string
    const outcomes: string[] = typeof market.outcomes === 'string'
      ? JSON.parse(market.outcomes)
      : (market.outcomes || []);
    
    // Parse outcomePrices - also a JSON string  
    const prices: string[] = typeof market.outcomePrices === 'string'
      ? JSON.parse(market.outcomePrices)
      : (market.outcomePrices || []);
    
    // Combine them
    for (let i = 0; i < tokenIds.length; i++) {
      tokens.push({
        token_id: tokenIds[i],
        outcome: outcomes[i] || `Outcome ${i + 1}`,
        price: prices[i] ? parseFloat(prices[i]) : 0
      });
    }
  } catch (error) {
    console.error("   Error parsing token data:", error);
  }
  
  return tokens;
}

async function main(): Promise<void> {
  const input = process.argv[2];

  if (!input) {
    console.log("\n❌ Error: Please provide a market URL or slug\n");
    console.log("Usage:");
    console.log('  npm run get-tokens "https://polymarket.com/event/bitcoin-up-or-down-on-december-8"');
    console.log('  npm run get-tokens "bitcoin-up-or-down-on-december-8"\n');
    process.exit(1);
  }

  const slug = extractSlug(input);
  console.log(`\n🔍 Fetching market: ${slug}...\n`);

  try {
    const markets = await fetchMarketsBySlug(slug);

    console.log("═".repeat(80));
    
    if (!markets || markets.length === 0) {
      console.log("\n❌ No markets found for this slug.\n");
      console.log("Troubleshooting:");
      console.log("1. Verify the slug is correct");
      console.log("2. Check if the market is still active");
      console.log('3. Try: npm run find-tokens\n');
      process.exit(1);
    }

    // Process each market
    for (let i = 0; i < markets.length; i++) {
      const market = markets[i];
      
      if (i > 0) {
        console.log("\n" + "─".repeat(80) + "\n");
      }

      console.log(`\n📊 ${market.question || "Unknown Market"}\n`);
      console.log("─".repeat(80));
      
      if (market.volume) {
        const vol = parseFloat(market.volume);
        console.log(`Volume: $${vol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      }
      
      if (market.active !== undefined) {
        console.log(`Active: ${market.active ? "Yes" : "No"}`);
      }
      
      console.log(`Slug: ${market.slug || slug}`);

      if (market.description) {
        const desc = market.description.substring(0, 150);
        console.log(`\nDescription: ${desc}${market.description.length > 150 ? "..." : ""}`);
      }

      console.log("\n" + "─".repeat(80));
      console.log("\n🎯 TOKENS:\n");

      // Parse token data
      const tokens = parseTokenData(market);

      if (tokens.length === 0) {
        console.log("❌ No tokens found for this market.");
        console.log("   The market may not have tokens yet.\n");
        continue;
      }

      tokens.forEach((token, index) => {
        const outcomeLabel = token.outcome.padEnd(15);
        const price = token.price 
          ? `${(token.price * 100).toFixed(1)}%`.padStart(8)
          : "N/A     ";
        
        console.log(`${index + 1}. Outcome: ${outcomeLabel} Price: ${price}`);
        console.log(`   Token ID: ${token.token_id}\n`);
        console.log(`   💻 Monitor this outcome:`);
        console.log(`   npm start -- ${token.token_id}\n`);
      });
    }

    console.log("═".repeat(80));
    console.log("\n✅ Copy one of the token IDs above and use it with 'npm start'!\n");

  } catch (error) {
    console.error("\n❌ Error fetching market:");
    
    if (error instanceof Error) {
      console.error(`   ${error.message}\n`);
    } else {
      console.error(`   ${error}\n`);
    }
    
    console.log("Troubleshooting:");
    console.log("1. Check that the slug/URL is correct");
    console.log("2. Verify the market exists at: https://polymarket.com/markets");
    console.log("3. Try searching: npm run find-tokens <search_term>");
    console.log("4. Example: npm run find-tokens bitcoin\n");
    process.exit(1);
  }
}

main();
