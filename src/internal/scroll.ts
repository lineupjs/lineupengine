

export declare type IDelayedMode = number | 'animation' | 'sync' | 'immediate';

export const defaultMode: IDelayedMode = 'animation'; // Boolean((<any>window).chrome) ? 'animation' : 0, // animation frame on chrome;

export interface IScrollInfo {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface IScrollHandler {
  timer: number;
  prev: IScrollInfo | null;
  handler: ((act: IScrollInfo) => void)[];
}

function dummy(): IScrollHandler {
  return {
    handler: [],
    prev: null,
    timer: -1
  };
}

class ScrollHandler {
  private readonly sync = dummy();
  private readonly animation = dummy();
  private readonly immediate = dummy();
  private readonly numbers = new Map<number, IScrollHandler>();

  // current: IScrollInfo;
  // private prev: IScrollInfo | null = null;

  get current() {
    return this.asInfo();
  }

  constructor(private readonly node: HTMLElement) {
    // this.current = this.asInfo();

    node.addEventListener('scroll', () => {
      // this.current = this.asInfo();

      // if (this.prev && (Math.abs(this.current.left - this.prev.left) + Math.abs(this.current.top - this.prev.top)) < 4) {
      //   return;
      // }
      // this.prev = this.current;

      if (this.sync.handler.length > 0) {
        this.handle(this.sync);
      }
      this.handleAnimation();
      this.handleImmediate();
      this.handleTimeouts();
    }, {
        passive: true
      });
  }

  private handle(handler: IScrollHandler) {
    const info = this.current;
    if (handler.prev && (Math.abs(info.left - handler.prev.left) + Math.abs(info.top - handler.prev.top)) < 4) {
      return;
    }
    handler.prev = info;
    for (const s of handler.handler) {
      s(info);
    }
  }

  private handleAnimation() {
    if (this.animation.timer !== -1 || this.animation.handler.length === 0) {
      return;
    }
    this.animation.timer = 1;
    requestAnimationFrame(this.handleAnimationImpl);
  }

  private readonly handleAnimationImpl = () => {
    if (this.animation.timer !== 1) {
      return;
    }
    this.handle(this.animation);
    this.animation.timer = -1;
  };

  private handleImmediate() {
    if (this.immediate.timer >= 0 || this.immediate.handler.length === 0) {
      return;
    }
    this.immediate.timer = self.setImmediate(this.handleImmediateImpl);
  }

  private readonly handleImmediateImpl = () => {
    if (this.immediate.timer < 0) {
      return;
    }
    this.handle(this.immediate);
    this.immediate.timer = -1;
  };

  private handleTimeouts() {
    if (this.numbers.size === 0) {
      return;
    }

    this.numbers.forEach((handler, n) => {
      if (handler.handler.length === 0) {
        return;
      }
      handler.timer = self.setTimeout(() => {
        this.handle(handler);
        handler.timer = -1;
      }, n);
    });
  }

  asInfo(): IScrollInfo {
    return {
      left: this.node.scrollLeft,
      top: this.node.scrollTop,
      width: this.node.clientWidth,
      height: this.node.clientHeight
    };
  }

  push(mode: IDelayedMode, handler: (act: IScrollInfo) => void) {
    // convert mode
    if (mode === 'immediate' && typeof (self.setImmediate) !== 'function') {
      mode = 0;
    }

    if (typeof mode === 'number') {
      if (!this.numbers.has(mode)) {
        this.numbers.set(mode, dummy());
      }
      this.numbers.get(mode)!.handler.push(handler);
    }

    switch (mode) {
      case 'sync':
        this.sync.handler.push(handler);
        break;
      case 'immediate':
        this.immediate.handler.push(handler);
        break;
      case 'animation':
        this.animation.handler.push(handler);
        break;
    }
  }


  remove(handler: (act: IScrollInfo) => void) {
    const test = [this.sync, this.animation, this.immediate].concat(Array.from(this.numbers.values()));

    return test.some((d) => {
      const index = d.handler.indexOf(handler);
      if (index >= 0) {
        d.handler.splice(index, 1);
      }
      return index >= 0;
    });
  }

  isWaiting(mode: IDelayedMode) {
    switch (mode) {
      case 'immediate':
        return this.immediate.timer >= 0;
      case 'animation':
        return this.animation.timer >= 0;
      case 'sync':
        return false;
      default:
        return this.numbers.has(mode) && this.numbers.get(mode)!.timer >= 0;
    }
  }
}

/**
 * @internal
 */
export function addScroll(scroller: HTMLElement, mode: IDelayedMode, handler: (act: IScrollInfo) => void) {
  // hide in element to have just one real listener
  if (!(<any>scroller).__le_scroller__) {
    (<any>scroller).__le_scroller__ = new ScrollHandler(scroller);
  }
  const s: ScrollHandler = (<any>scroller).__le_scroller__;
  s.push(mode, handler);
  return s.asInfo();
}

/**
 * @internal
 */
export function isScrollEventWaiting(scroller: HTMLElement, mode: IDelayedMode) {
  if (!(<any>scroller).__le_scroller__) {
    return false;
  }
  const s: ScrollHandler = (<any>scroller).__le_scroller__;
  return s.isWaiting(mode);
}

/**
 * @internal
 */
export function removeScroll(scroller: HTMLElement, handler: (act: IScrollInfo) => void) {
  if ((<any>scroller).__le_scroller__) {
    (<ScrollHandler>(<any>scroller).__le_scroller__).remove(handler);
  }
}
