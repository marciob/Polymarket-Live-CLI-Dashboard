/**
 * Blessed box configurations
 */

import blessed from "blessed";

export function createStatusBar(): blessed.Widgets.BoxElement {
  return blessed.box({
    top: 0,
    left: 0,
    width: "100%",
    height: 3,
    tags: true,
    border: { type: "line" },
    style: {
      fg: "white",
      border: { fg: "cyan" },
    },
  });
}

export function createTradesBox(): blessed.Widgets.BoxElement {
  return blessed.box({
    top: 3,
    left: 0,
    width: "33%",
    height: "50%-3",
    label: " Market Trades (0) ",
    tags: true,
    border: { type: "line" },
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: " ",
      style: { bg: "blue" },
    },
    style: {
      fg: "white",
      border: { fg: "green" },
    },
  });
}

export function createSimulatedTradesBox(): blessed.Widgets.BoxElement {
  return blessed.box({
    top: "50%",
    left: 0,
    width: "33%",
    height: "50%",
    label: " Simulated Trades (0) ",
    tags: true,
    border: { type: "line" },
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: " ",
      style: { bg: "blue" },
    },
    style: {
      fg: "white",
      border: { fg: "magenta" },
    },
  });
}

export function createOrderBookBox(): blessed.Widgets.BoxElement {
  return blessed.box({
    top: 3,
    left: "33%",
    width: "67%",
    height: "50%-3",
    label: " Order Book ",
    tags: true,
    border: { type: "line" },
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: " ",
      style: { bg: "blue" },
    },
    style: {
      fg: "white",
      border: { fg: "yellow" },
    },
  });
}

export function createPortfolioBox(): blessed.Widgets.BoxElement {
  return blessed.box({
    top: "50%",
    left: "33%",
    width: "67%",
    height: "50%",
    label: " Portfolio ",
    tags: true,
    border: { type: "line" },
    style: {
      fg: "white",
      border: { fg: "cyan" },
    },
  });
}

