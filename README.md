# Polymarket Live CLI Dashboard

Real-time terminal dashboard for Polymarket order books and trades.

## Quick Start

```bash
npm install
npm start -- "https://polymarket.com/event/your-market"
```

## Usage

**Basic usage:**

```bash
npm start -- "https://polymarket.com/event/bitcoin-up-or-down-on-december-8"
```

**Multi-outcome markets:**

```bash
npm start -- "https://polymarket.com/event/fed-decision-in-december" --outcome "25 bps decrease"
npm start -- "https://polymarket.com/event/fed-decision-in-december" --outcome 2
```

## Helper Scripts

```bash
# Get token IDs from URL
npm run get-tokens "https://polymarket.com/event/bitcoin-up-or-down-on-december-8"

# Search markets
npm run find-tokens
npm run find-tokens bitcoin

# 15-minute crypto markets (high volume)
npm run get-15min btc
npm run get-15min eth
```

## Dashboard

- **Left Panel:** Recent trades (time, side, price, size, notional)
- **Right Panel:** Live order book (bids/asks with spread)
- **Status Bar:** Connection status, market name, outcome

**Controls:** `q`, `ESC`, or `Ctrl+C` to quit

## Development

```bash
npm run dev "https://polymarket.com/event/your-market"  # Development mode
npm run build                                             # Build TypeScript
npm run clean                                             # Clean build
```

## Project Structure

```
src/
├── index.ts              # Entry point
├── types.ts              # TypeScript types
├── websocket/client.ts   # WebSocket client
└── ui/renderer.ts        # TUI renderer
```

## Troubleshooting

**"Waiting for trades..."** - Normal for low-volume markets. Try `npm run get-15min btc` for active markets.

**"Invalid token ID"** - The `tid` URL parameter is NOT a token ID. Use `npm run get-tokens "https://polymarket.com/event/your-market"` first.

## API

- **WebSocket:** `wss://ws-subscriptions-clob.polymarket.com/ws/market`
- **REST:** `https://gamma-api.polymarket.com`
- **Docs:** https://docs.polymarket.com/developers/CLOB/websocket/market-channel

## License

MIT

## Disclaimer

Unofficial tool. Not affiliated with Polymarket. Use at your own risk.
