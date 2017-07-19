/**
 * Created by Samuel Gratzl on 13.07.2017.
 */
import {ABaseRenderer} from './ABaseRenderer';
import {range} from './logic';
export {IRenderContext, abortAble} from './ABaseRenderer';

export interface IPrefetchRendererOptions {
  /**
   * number of rows to prefetch
   * @default 20
   */
  readonly prefetchRows?: number;
  /**
   * number of rows extra before cleaning them up
   * @default 3
   */
  readonly cleanUpRows?: number;
  /**
   * delay to trigger a prefetch or clean up
   * @default 50ms
   */
  readonly delay?: number;
}

export abstract class APrefetchRenderer extends ABaseRenderer {
  private prefetchTimeout: number = -1;

  private readonly options = {
    prefetchRows: 20,
    cleanUpRows: 3,
    delay: 50
  };


  constructor(node: HTMLElement, options: IPrefetchRendererOptions = {}) {
    super(node);
    Object.assign(this.options, options);
  }


  private prefetchDown() {
    this.prefetchTimeout = -1;
    const context = this.context;
    const nextLast = Math.min(this.visible.last + this.options.prefetchRows, context.numberOfRows - 1);
    // add some rows in advance
    if (this.visible.last === nextLast && this.visible.last >= (this.visible.forcedLast + this.options.prefetchRows)) {
      return;
    }

    this.addAtBottom(this.visible.last + 1, nextLast);
    //console.log('prefetch', visibleFirst, visibleLast + 1, '=>', nextLast, ranking.children.length);
    this.visible.last = nextLast;
  }

  private prefetchUp() {
    this.prefetchTimeout = -1;
    if (this.visible.first <= (this.visible.forcedFirst - this.options.prefetchRows!)) {
      return;
    }
    const context = this.context;
    const fakeOffset = Math.max(context.scroller.scrollTop - this.options.prefetchRows! * context.defaultRowHeight, 0);
    const height = context.scroller.clientHeight;
    const {first, firstRowPos} = range(fakeOffset, height, context.defaultRowHeight, context.exceptions, context.numberOfRows);

    if (first === this.visible.first) {
      return;
    }

    this.addAtBeginning(first, this.visible.first - 1);
    //console.log('prefetch up ', visibleFirst, '=>', first, visibleLast, ranking.children.length);
    this.visible.first = first;

    this.updateOffset(firstRowPos, context.totalHeight);
  }

  private triggerPrefetch(isGoingDown: boolean) {
    if (this.prefetchTimeout >= 0) {
      clearTimeout(this.prefetchTimeout);
    }

    if ((isGoingDown && this.visible.last >= (this.visible.forcedLast + this.options.prefetchRows)) || (!isGoingDown && this.visible.first <= (this.visible.forcedFirst - this.options.prefetchRows))) {
      return;
    }

    this.prefetchTimeout = setTimeout(isGoingDown ? this.prefetchDown.bind(this) : this.prefetchUp.bind(this), this.options.delay);
  }

  private cleanUpTop(first: number) {
    this.prefetchTimeout = -1;
    const newFirst = first - this.options.cleanUpRows;

    if (newFirst <= this.visible.first) {
      return;
    }

    this.removeFromBeginning(this.visible.first, newFirst - 1);
    const context = this.context;
    //console.log('cleanup up ', visibleFirst, '=>', newFirst, visibleLast, ranking.children.length);
    let shift = (newFirst - this.visible.first) * context.defaultRowHeight;
    if (context.exceptions.length > 0) {
      for (let i = this.visible.first; i < newFirst; ++i) {
        if (context.exceptionsLookup.has(i)) {
          shift += context.exceptionsLookup.get(i)! - context.defaultRowHeight;
        }
      }
    }
    this.visible.first = newFirst;
    this.updateOffset(this.visibleFirstRowPos + shift, context.totalHeight);

    this.prefetchDown();
  }

  private cleanUpBottom(last: number) {
    this.prefetchTimeout = -1;
    const newLast = last + this.options.cleanUpRows;
    if (this.visible.last <= newLast) {
      return;
    }
    this.removeFromBottom(newLast + 1, this.visible.last);
    //console.log('cleanup bottom', visibleFirst, visibleLast, '=>', newLast, ranking.children.length);
    this.visible.last = newLast;

    this.prefetchUp();
  }

  private triggerCleanUp(first: number, last: number, isGoingDown: boolean) {
    if (this.prefetchTimeout >= 0) {
      clearTimeout(this.prefetchTimeout);
    }
    if ((isGoingDown && (first - this.options.cleanUpRows) <= this.visible.first) || (!isGoingDown && this.visible.last <= (last + this.options.cleanUpRows))) {
      return;
    }

    this.prefetchTimeout = setTimeout(isGoingDown ? this.cleanUpTop.bind(this) : this.cleanUpBottom.bind(this), this.options.delay, isGoingDown ? first : last);
  }


  protected onScrolledVertically(scrollTop: number, clientHeight: number, isGoingDown: boolean, scrollLeft: number): 'full' | 'partial' {
    const r = super.onScrolledVertically(scrollTop, clientHeight, isGoingDown, scrollLeft);

    if (r === 'full') {
      if (this.options.cleanUpRows > 0) {
        this.triggerCleanUp(this.visible.forcedFirst, this.visible.forcedLast, isGoingDown);
      }
    } else if (this.options.prefetchRows > 0) {
      this.triggerPrefetch(isGoingDown);
    }
    return r;
  }
}

export default APrefetchRenderer;
