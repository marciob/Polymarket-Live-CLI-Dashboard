# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-08

### Added

- Real-time order book visualization with live bid/ask levels
- Streaming trade feed with price, size, and notional value
- Direct URL support - paste Polymarket URLs directly
- Multi-outcome market support with outcome selection
- Auto-reconnection on WebSocket disconnect
- Built-in keepalive (PING/PONG)
- Helper scripts for finding markets and token IDs
- 15-minute crypto market finder for high-frequency trading
- Clean TUI interface using `blessed`
- Spread calculation (cents and basis points)
- Trade count display in panel header

### Features

- **WebSocket Client**: Handles `book`, `last_trade_price`, and `price_change` messages
- **UI Renderer**: Two-panel layout with color-coded buy/sell indicators
- **State Management**: In-memory state with circular buffer for trades
- **Error Handling**: Graceful degradation and clear error messages
- **Documentation**: Comprehensive README with examples

### Technical Details

- TypeScript with strict mode
- No external database required
- Efficient incremental order book updates
- Maintains last 100 trades in memory
- Auto-detects event vs market slugs
