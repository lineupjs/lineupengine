/**
 * Created by Samuel Gratzl on 13.07.2017.
 */
import {ABaseRenderer} from './ABaseRenderer';
import {range} from './logic';
export {IRenderContext} from './ABaseRenderer';

export interface IPrefetchRendererOptions {
  readonly prefetchRows?: number;
  readonly cleanUpRows?: number;
  readonly delay?: number;
}


export abstract class APrefetchRenderer extends ABaseRenderer {
  private prefetchTimeout: number = -1;

  private readonly options: IPrefetchRendererOptions = {
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
    const nextLast = Math.min(this.visibleLast + this.options.prefetchRows, context.numberOfRows - 1);
    // add some rows in advance
    if (this.visibleLast === nextLast && this.visibleLast >= (this.visibleForcedLast + this.options.prefetchRows)) {
      return;
    }

    this.addAtBottom(this.visibleLast + 1, nextLast);
    //console.log('prefetch', visibleFirst, visibleLast + 1, '=>', nextLast, ranking.children.length);
    this.visibleLast = nextLast;
  }

  private prefetchUp() {
    this.prefetchTimeout = -1;
    if (this.visibleFirst <= (this.visibleForcedFirst - this.options.prefetchRows)) {
      return;
    }
    const context = this.context;
    const fakeOffset = Math.max(context.scroller.scrollTop - this.options.prefetchRows * context.defaultRowHeight, 0);
    const height = context.scroller.clientHeight;
    const {first, last, firstRowPos} = range(fakeOffset, height, context.defaultRowHeight, context.exceptions, context.numberOfRows);

    if (first === this.visibleFirst) {
      return;
    }

    this.addAtBeginning(first, this.visibleFirst - 1);
    //console.log('prefetch up ', visibleFirst, '=>', first, visibleLast, ranking.children.length);
    this.visibleFirst = first;

    this.updateOffset(firstRowPos, context.totalHeight);
  }

  private triggerPrefetch(isGoingDown: boolean) {
    if (this.prefetchTimeout >= 0) {
      clearTimeout(this.prefetchTimeout);
    }

    if ((isGoingDown && this.visibleLast >= (this.visibleForcedLast + this.options.prefetchRows)) || (!isGoingDown && this.visibleFirst <= (this.visibleForcedFirst - this.options.prefetchRows))) {
      return;
    }

    this.prefetchTimeout = setTimeout(isGoingDown ? this.prefetchDown.bind(this) : this.prefetchUp.bind(this), 20);
  }

  private cleanUpTop(first: number) {
    this.prefetchTimeout = -1;
    const newFirst = first - this.options.cleanUpRows;

    if (newFirst <= this.visibleFirst) {
      return;
    }

    this.removeFromBeginning(this.visibleFirst, newFirst - 1);
    const context = this.context;
    //console.log('cleanup up ', visibleFirst, '=>', newFirst, visibleLast, ranking.children.length);
    let shift = (newFirst - this.visibleFirst) * context.defaultRowHeight;
    if (context.exceptions.length > 0) {
      for (let i = this.visibleFirst; i < newFirst; ++i) {
        if (context.exceptionsLookup.has(i)) {
          shift += context.exceptionsLookup.get(i) - context.defaultRowHeight;
        }
      }
    }
    this.visibleFirst = newFirst;
    this.updateOffset(this.visibleFirstRowPos + shift, context.totalHeight);

    this.prefetchDown();
  }

  private cleanUpBottom(last: number) {
    this.prefetchTimeout = -1;
    const newLast = last + this.options.cleanUpRows;
    if (this.visibleLast <= newLast) {
      return;
    }
    this.removeFromBottom(newLast + 1, this.visibleLast);
    //console.log('cleanup bottom', visibleFirst, visibleLast, '=>', newLast, ranking.children.length);
    this.visibleLast = newLast;

    this.prefetchUp();
  }

  private triggerCleanUp(first: number, last: number, isGoingDown: boolean) {
    if (this.prefetchTimeout >= 0) {
      clearTimeout(this.prefetchTimeout);
    }
    if ((isGoingDown && (first - this.options.cleanUpRows) <= this.visibleFirst) || (!isGoingDown && this.visibleLast <= (last + this.options.cleanUpRows))) {
      return;
    }

    this.prefetchTimeout = setTimeout(isGoingDown ? this.cleanUpTop.bind(this) : this.cleanUpBottom.bind(this), 20, isGoingDown ? first : last);
  }


  protected onScrolled(scrollTop: number, clientHeight: number, isGoingDown: boolean, scrollLeft: number): 'full' | 'partial' {
    const r = super.onScrolledVertically(scrollTop, clientHeight, isGoingDown, scrollLeft);
    if (r === 'full') {
      this.triggerCleanUp(this.visibleForcedFirst, this.visibleForcedLast, isGoingDown);
    } else {
      this.triggerPrefetch(isGoingDown);
    }
    return r;
  }
}

export default APrefetchRenderer;
