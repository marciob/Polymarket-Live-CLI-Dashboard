/**
 * Keyboard event handlers for the dashboard
 */

import blessed from "blessed";

interface ScrollableBox {
  box: blessed.Widgets.BoxElement;
  label: string;
}

export class KeyboardHandler {
  private focusedBox: blessed.Widgets.BoxElement | null = null;
  private focusedIndex: number = -1;

  constructor(
    private screen: blessed.Widgets.Screen,
    private boxes: ScrollableBox[],
    private onExit: () => void
  ) {
    this.setupKeyBindings();
  }

  private setupKeyBindings(): void {
    this.setupQuitKeys();
    this.setupTabCycle();
    this.setupScrollKeys();
  }

  private setupQuitKeys(): void {
    this.screen.key(["escape", "q", "Q", "C-c"], () => {
      this.onExit();
    });
  }

  private setupTabCycle(): void {
    this.screen.key(["tab"], () => {
      this.cycleToNextBox();
    });
  }

  private setupScrollKeys(): void {
    this.screen.key(["up"], () => this.scrollFocusedBox(-1));
    this.screen.key(["down"], () => this.scrollFocusedBox(1));
    this.screen.key(["pageup"], () => this.scrollFocusedBox(-10));
    this.screen.key(["pagedown"], () => this.scrollFocusedBox(10));
  }

  private cycleToNextBox(): void {
    this.focusedIndex = (this.focusedIndex + 1) % this.boxes.length;
    this.focusedBox = this.boxes[this.focusedIndex].box;

    this.updateBoxLabels();
    this.screen.render();
  }

  private updateBoxLabels(): void {
    this.boxes.forEach((item, idx) => {
      const prefix = idx === this.focusedIndex ? "[FOCUSED] " : "";
      const baseLabel = item.label;
      item.box.setLabel(` ${prefix}${baseLabel} `);
    });
  }

  private scrollFocusedBox(amount: number): void {
    if (this.focusedBox) {
      try {
        this.focusedBox.scroll(amount);
        this.screen.render();
      } catch (error) {
        // Ignore scroll errors
      }
    }
  }
}
