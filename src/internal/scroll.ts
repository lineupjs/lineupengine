

export declare type IDelayedMode = number | 'animation' | 'sync' | 'immediate';

export const defaultMode: IDelayedMode = 'animation'; // Boolean((<any>window).chrome) ? 'animation' : 0, // animation frame on chrome;

/**
 * @internal
 */
export interface IScrollInfo {
  left: number;
  top: number;
  width: number;
  height: number;
}

class ScrollHandler {
  private hasNumbers = false;
  private readonly handlers = new Map<IDelayedMode, ((act: IScrollInfo)=>void)[]>();
  private animationWaiting = false;
  private immediateTimeout = -1;
  private readonly timersWaiting = new Set<number>();

  private readonly prevs = new Map<IDelayedMode, IScrollInfo>();

  constructor(private readonly node: HTMLElement) {
    node.addEventListener('scroll', () => {
      this.handle('sync');
      this.handleAnimation();
      this.handleImmediate();
      this.handleTimeouts();
    }, {
      passive: true
    });
  }

  private has(mode: IDelayedMode) {
    return this.handlers.has(mode) && this.handlers.get(mode)!.length > 0;
  }

  private handle(mode: IDelayedMode) {
    const handlers = this.handlers.get(mode) || [];
    if (!handlers || handlers.length <= 0) {
      return;
    }
    const info = this.asInfo();
    if (this.prevs.has(mode)) {
      const prev = this.prevs.get(mode)!;
      if ((Math.abs(info.left - prev.left) + Math.abs(info.top - prev.top)) < 4) {
        return;
      }
    }
    this.prevs.set(mode, info);
    for (const s of handlers) {
      s(info);
    }
  }

  private handleAnimation() {
    if (this.animationWaiting || !this.has('animation')) {
      return;
    }
    this.animationWaiting = true;
    requestAnimationFrame(this.handleAnimationImpl);
  }

  private readonly handleAnimationImpl = () => {
    if (!this.animationWaiting) {
      return;
    }
    this.handle('animation');
    this.animationWaiting = false;
  };

  private handleImmediate() {
    if (this.immediateTimeout >= 0 || !this.has('immediate')) {
      return;
    }
    this.immediateTimeout = self.setImmediate(this.handleImmediateImpl);
  }

  private readonly handleImmediateImpl = () => {
    if (this.immediateTimeout < 0) {
      return;
    }
    this.handle('immediate');
    this.immediateTimeout = -1;
  };

  private handleTimeouts() {
    if (!this.hasNumbers) {
      return;
    }

    const numbers = <number[]>Array.from(this.handlers.keys()).filter((d) => typeof d === 'number' && !this.timersWaiting.has(d));
    if (numbers.length === 0) {
      return;
    }
    for(const n of numbers) {
      this.timersWaiting.add(n);
      self.setTimeout(() => {
        this.timersWaiting.delete(n);
        this.handle(n);
      }, n);
    }
  }

  asInfo(): IScrollInfo {
    return {
      left: this.node.scrollLeft,
      top: this.node.scrollTop,
      width: this.node.clientWidth,
      height: this.node.clientHeight
    };
  }

  push(mode: IDelayedMode, handler: (act: IScrollInfo)=>void) {
    // convert mode
    if (mode === 'immediate' && typeof (self.setImmediate) !== 'function') {
      mode = 0;
    }
    if (typeof mode === 'number') {
      this.hasNumbers = true;
    }
    if (this.handlers.has(mode)) {
      this.handlers.get(mode)!.push(handler);
    } else {
      this.handlers.set(mode, [handler]);
    }
  }

  remove(handler: (act: IScrollInfo)=>void) {
    return Array.from(this.handlers.values()).some((d) => {
      const index = d.indexOf(handler);
      if (index >= 0) {
        d.splice(index, 1);
      }
      return index >= 0;
    });
  }

  isWaiting(mode: IDelayedMode) {
    switch(mode) {
    case 'immediate':
      return this.immediateTimeout > 0;
    case 'animation':
      return this.animationWaiting;
    case 'sync':
      return false;
    default:
      return this.handlers.has(mode);
    }
  }
}

/**
 * @internal
 */
export function addScroll(scroller: HTMLElement, mode: IDelayedMode, handler: (act: IScrollInfo)=>void) {
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
export function removeScroll(scroller: HTMLElement, handler: (act: IScrollInfo)=>void) {
  if ((<any>scroller).__le_scroller__) {
    (<ScrollHandler>(<any>scroller).__le_scroller__).remove(handler);
  }
}
