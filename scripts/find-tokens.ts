#!/usr/bin/env ts-node

/**
 * Helper script to find Polymarket token IDs from active markets
 * 
 * Usage:
 *   npx ts-node scripts/find-tokens.ts [search_term]
 * 
 * Examples:
 *   npx ts-node scripts/find-tokens.ts              # Show all active markets
 *   npx ts-node scripts/find-tokens.ts trump        # Search for "trump"
 *   npx ts-node scripts/find-tokens.ts election     # Search for "election"
 */

import https from "https";

interface Market {
  question: string;
  slug: string;
  clobTokenIds?: string | string[];
  outcomes?: string | string[];
  outcomePrices?: string | string[];
  volume: string;
  active: boolean;
}

function fetchMarkets(searchTerm?: string): Promise<Market[]> {
  return new Promise((resolve, reject) => {
    const url = "https://gamma-api.polymarket.com/markets?limit=20&closed=false&order=volume&ascending=false";

    https.get(url, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const markets: Market[] = JSON.parse(data);
          
          if (searchTerm) {
            const filtered = markets.filter((m) =>
              m.question.toLowerCase().includes(searchTerm.toLowerCase())
            );
            resolve(filtered);
          } else {
            resolve(markets);
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

function parseTokenData(market: Market): Array<{ token_id: string; outcome: string }> {
  const tokens: Array<{ token_id: string; outcome: string }> = [];
  
  try {
    // Parse clobTokenIds - it's a JSON string
    const tokenIds: string[] = typeof market.clobTokenIds === 'string' 
      ? JSON.parse(market.clobTokenIds) 
      : (market.clobTokenIds || []);
    
    // Parse outcomes - it's also a JSON string
    const outcomes: string[] = typeof market.outcomes === 'string'
      ? JSON.parse(market.outcomes)
      : (market.outcomes || []);
    
    // Combine them
    for (let i = 0; i < tokenIds.length; i++) {
      tokens.push({
        token_id: tokenIds[i],
        outcome: outcomes[i] || `Token ${i + 1}`
      });
    }
  } catch (error) {
    // Silently skip markets with parsing errors
  }
  
  return tokens;
}

async function main(): Promise<void> {
  const searchTerm = process.argv[2];

  console.log("\n🔍 Fetching active Polymarket markets...\n");

  try {
    const markets = await fetchMarkets(searchTerm);

    if (markets.length === 0) {
      console.log(`❌ No markets found${searchTerm ? ` matching "${searchTerm}"` : ""}\n`);
      return;
    }

    console.log(`Found ${markets.length} market${markets.length > 1 ? "s" : ""}:\n`);
    console.log("═".repeat(80) + "\n");

    markets.slice(0, 10).forEach((market, index) => {
      console.log(`${index + 1}. ${market.question}`);
      console.log(`   Volume: $${parseFloat(market.volume).toLocaleString()}`);
      console.log(`   Slug: ${market.slug}`);
      
      const tokens = parseTokenData(market);
      
      if (tokens.length > 0) {
        console.log("\n   Tokens:");
        tokens.forEach((token) => {
          console.log(`     ${token.outcome.padEnd(10)} ${token.token_id}`);
        });
        
        console.log("\n   📊 Monitor this market:");
        console.log(`     npm start -- ${tokens[0].token_id}\n`);
      } else {
        console.log("\n   ⚠️  No tokens available yet\n");
      }
      
      console.log("─".repeat(80) + "\n");
    });

    if (markets.length > 10) {
      console.log(`... and ${markets.length - 10} more markets\n`);
    }

  } catch (error) {
    console.error("❌ Error fetching markets:", error);
    process.exit(1);
  }
}

main();
