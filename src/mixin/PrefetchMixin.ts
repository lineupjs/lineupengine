import {range} from '../logic';
import {EScrollResult, IMixin, IMixinAdapter} from './IMixin';

export interface IPrefetchRendererOptions {
  /**
   * number of rows to prefetch
   * @default 20
   */
  readonly prefetchRows: number;
  /**
   * number of rows extra before cleaning them up
   * @default 3
   */
  readonly cleanUpRows: number;
  /**
   * delay to trigger a prefetch or clean up
   * @default 50ms
   */
  readonly delay: number;
}

/**
 * mixin that prefetches rows depending on the scrolling direction for faster rendering
 */
export default class PrefetchMixin implements IMixin {
  private prefetchTimeout: number = -1;

  private readonly options: IPrefetchRendererOptions = {
    prefetchRows: 20,
    cleanUpRows: 3,
    delay: 50
  };

  constructor(private readonly adapter: IMixinAdapter, options?: Partial<IPrefetchRendererOptions>) {
    Object.assign(this.options, options);
    return this;
  }


  private prefetchDown() {
    this.prefetchTimeout = -1;
    const context = this.adapter.context;
    const nextLast = Math.min(this.adapter.visible.last + this.options.prefetchRows, context.numberOfRows - 1);
    // add some rows in advance
    if (this.adapter.visible.last === nextLast && this.adapter.visible.last >= (this.adapter.visible.forcedLast + this.options.prefetchRows)) {
      return;
    }

    this.adapter.addAtBottom(this.adapter.visible.last + 1, nextLast);
    //console.log('prefetch', visibleFirst, visibleLast + 1, '=>', nextLast, ranking.children.length);
    this.adapter.visible.last = nextLast;
  }

  private prefetchUp() {
    this.prefetchTimeout = -1;
    if (this.adapter.visible.first <= (this.adapter.visible.forcedFirst - this.options.prefetchRows!)) {
      return;
    }
    const context = this.adapter.context;
    const scroller = this.adapter.scroller;
    const fakeOffset = Math.max(scroller.scrollTop - this.options.prefetchRows! * context.defaultRowHeight, 0);
    const height = scroller.clientHeight;
    const {first, firstRowPos} = range(fakeOffset, height, context.defaultRowHeight, context.exceptions, context.numberOfRows);

    if (first === this.adapter.visible.first) {
      return;
    }

    const frozenShift = this.adapter.syncFrozen ? this.adapter.syncFrozen(first) : 0;

    this.adapter.addAtBeginning(first, this.adapter.visible.first - 1, frozenShift);
    //console.log('prefetch up ', visibleFirst, '=>', first, visibleLast, ranking.children.length);
    this.adapter.visible.first = first;

    this.adapter.updateOffset(firstRowPos);
  }

  private triggerPrefetch(isGoingDown: boolean) {
    if (this.prefetchTimeout >= 0) {
      clearTimeout(this.prefetchTimeout);
    }

    const prefetchDownPossible = this.adapter.visible.last < (this.adapter.visible.forcedLast + this.options.prefetchRows);
    const prefetchUpPossible = this.adapter.visible.first > (this.adapter.visible.forcedFirst - this.options.prefetchRows);

    const isLast = this.adapter.visible.last === this.adapter.context.numberOfRows;
    const isFirst = this.adapter.visible.first === 0;

    if ((isGoingDown && !prefetchDownPossible && !isLast) || (!isGoingDown && !prefetchUpPossible && !isFirst)) {
      return;
    }

    // go down if we are already at the top, too
    const op = (isGoingDown || isFirst) ? this.prefetchDown.bind(this) : this.prefetchUp.bind(this);

    this.prefetchTimeout = setTimeout(op, this.options.delay);
  }

  private cleanUpTop(first: number) {
    this.prefetchTimeout = -1;
    const newFirst = Math.max(0, first - this.options.cleanUpRows);

    if (newFirst <= this.adapter.visible.first) {
      return;
    }

    const frozenShift = this.adapter.syncFrozen ? this.adapter.syncFrozen(newFirst) : 0;

    this.adapter.removeFromBeginning(this.adapter.visible.first, newFirst - 1, frozenShift);
    const context = this.adapter.context;
    //console.log('cleanup up ', visibleFirst, '=>', newFirst, visibleLast, ranking.children.length);
    let shift = (newFirst - this.adapter.visible.first) * context.defaultRowHeight;
    if (context.exceptions.length > 0) {
      for (let i = this.adapter.visible.first; i < newFirst; ++i) {
        if (context.exceptionsLookup.has(i)) {
          shift += context.exceptionsLookup.get(i)! - context.defaultRowHeight;
        }
      }
    }
    this.adapter.visible.first = newFirst;
    this.adapter.updateOffset(this.adapter.visibleFirstRowPos + shift);

    this.prefetchDown();
  }

  private cleanUpBottom(last: number) {
    this.prefetchTimeout = -1;
    const newLast = last + this.options.cleanUpRows;
    if (this.adapter.visible.last <= newLast) {
      return;
    }
    this.adapter.removeFromBottom(newLast + 1, this.adapter.visible.last);
    //console.log('cleanup bottom', visibleFirst, visibleLast, '=>', newLast, ranking.children.length);
    this.adapter.visible.last = newLast;

    this.prefetchUp();
  }

  private triggerCleanUp(first: number, last: number, isGoingDown: boolean) {
    if (this.prefetchTimeout >= 0) {
      clearTimeout(this.prefetchTimeout);
    }
    if ((isGoingDown && (first - this.options.cleanUpRows) <= this.adapter.visible.first) || (!isGoingDown && this.adapter.visible.last <= (last + this.options.cleanUpRows))) {
      return;
    }

    this.prefetchTimeout = setTimeout(isGoingDown ? this.cleanUpTop.bind(this) : this.cleanUpBottom.bind(this), this.options.delay, isGoingDown ? first : last);
  }

  onScrolled(isGoingDown: boolean, scrollResult: EScrollResult) {
    if (scrollResult === EScrollResult.NONE) {
      if (this.options.cleanUpRows > 0) {
        this.triggerCleanUp(this.adapter.visible.forcedFirst, this.adapter.visible.forcedLast, isGoingDown);
      }
    } else if (this.options.prefetchRows > 0) {
      this.triggerPrefetch(isGoingDown);
    }
  }
}
