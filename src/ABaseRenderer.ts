/**
 * Created by Samuel Gratzl on 13.07.2017.
 */
import {IRowHeightException, IRowHeightExceptionLookup, range} from './logic';
import {IAbortAblePromise, isAbortAble} from './utils';
export {abortAble} from './utils';


export interface IRenderContext {
  readonly defaultRowHeight: number;
  readonly scroller: HTMLElement;
  readonly exceptions: IRowHeightException[];
  readonly exceptionsLookup: IRowHeightExceptionLookup;
  readonly numberOfRows: number;
  readonly totalHeight: number;
}

export abstract class ABaseRenderer {
  private readonly pool: HTMLElement[] = [];
  private readonly loading = new Map<HTMLElement, IAbortAblePromise<void>>();

  protected visibleFirst: number;
  protected visibleForcedFirst: number;
  protected visibleFirstRowPos: number;
  protected visibleLast: number;
  protected visibleForcedLast: number;

  constructor(protected readonly node: HTMLElement) {
  }

  protected abstract get context(): IRenderContext;

  protected abstract createRow(node: HTMLElement, index: number): IAbortAblePromise<void>|void;

  protected abstract updateRow(node: HTMLElement, index: number): IAbortAblePromise<void>|void;

  removeAll() {
    const arr = <HTMLElement[]>Array.from(this.node.children);
    this.pool.push(...arr);
    this.node.innerHTML = '';
    arr.forEach((item,) => {
      if (item.style.height) {
        item.style.height = null;
      }
    });
  }

  removeFromBeginning(from: number, to: number) {
    return this.remove(from, to, true);
  }

  removeFromBottom(from: number, to: number) {
    return this.remove(from, to, false);
  }


  private remove(from: number, to: number, fromBeginning: boolean) {
    for (let i = from; i <= to; ++i) {
      const item = <HTMLElement>(fromBeginning ? this.node.firstChild : this.node.lastChild);
      this.node.removeChild(item);
      if (item.style.height) {
        item.style.height = null;
      }
      // check if the dom element is still being manipulated
      if (this.loading.has(item)) {
        const abort = this.loading.get(item);
        abort.abort();
        abort.then(() => this.pool.push(item));
      } else {
        this.pool.push(item);
      }
    }
  }

  addAtBeginning(from: number, to: number) {
    return this.add(from, to, true);
  }

  addAtBottom(from: number, to: number) {
    return this.add(from, to, false);
  }

  private create(index: number) {
    let item: HTMLElement;
    let r: IAbortAblePromise<void>|void;
    if (this.pool.length > 0) {
      item = this.pool.pop();
      r = this.updateRow(item, index);
    } else {
      item = this.node.ownerDocument.createElement('div');
      r = this.createRow(item, index);
    }
    item.dataset.index = String(index);
    if (isAbortAble(r)) {
      item.classList.add('loading');
      this.loading.set(item, <IAbortAblePromise<void>>r);
      (<IAbortAblePromise<void>>r).then(() => {
        item.classList.remove('loading');
        this.loading.delete(item);
      });
    }
    return item;
  }

  private add(from: number, to: number, atBeginning: boolean) {
    if (!atBeginning) {
      for (let i = from; i <= to; ++i) {
        this.node.appendChild(this.create(i));
      }
    } else {
      for (let i = to; i >= from; --i) {
        this.node.insertAdjacentElement('afterbegin', this.create(i));
      }
    }
  }

  protected updateOffset(firstRowPos: number, totalHeight: number) {
    this.visibleFirstRowPos = firstRowPos;
    if (this.visibleFirst % 2 === 1) {
      //odd start patch for correct background
      this.node.classList.add('odd');
    } else {
      this.node.classList.remove('odd');
    }

    this.node.style.transform = `translate(0, ${firstRowPos.toFixed(0)}px)`;
    this.node.style.height = `${(totalHeight - firstRowPos).toFixed(0)}px`;
  }

  protected init(header: HTMLElement) {
    const context = this.context;
    const body = context.scroller;

    //sync scrolling of header and body
    let old = body.scrollTop;
    header.scrollLeft = body.scrollLeft;
    body.onscroll = (evt) => {
      //TODO based on scroll left decide whether certain rankings should be rendered or updated
      const scrollLeft = body.scrollLeft;
      if (header.scrollLeft !== scrollLeft) {
        header.scrollLeft = scrollLeft;
        this.onScrolledHorizontally(scrollLeft);
      }
      const top = body.scrollTop;
      if (old !== top) {
        const isGoingDown = top > old;
        old = top;
        this.onScrolledVertically(top, body.clientHeight, isGoingDown, scrollLeft);
      }
    };

    const {first, last, firstRowPos} = range(context.scroller.scrollTop, context.scroller.clientHeight, context.defaultRowHeight, context.exceptions, context.numberOfRows);

    this.visibleFirst = this.visibleForcedFirst = first;
    this.visibleLast = this.visibleForcedLast = last;

    this.addAtBottom(first, last);
    this.updateOffset(firstRowPos, context.totalHeight);
  }

  protected onScrolledHorizontally(scrollLeft: number) {
    // hook
  }


  protected onScrolledVertically(scrollTop: number, clientHeight: number, isGoingDown: boolean, scrollLeft: number): 'full' | 'partial' {
    const context = this.context;
    const {first, last, firstRowPos} = range(scrollTop, clientHeight, context.defaultRowHeight, context.exceptions, context.numberOfRows);

    this.visibleForcedFirst = first;
    this.visibleForcedLast = last;

    if ((first - this.visibleFirst) >= 0 && (last - this.visibleLast) <= 0) {
      //nothing to do
      return 'full';
    }

    if (first > this.visibleLast || last < this.visibleFirst) {
      //no overlap, clean and draw everything
      //console.log(`ff added: ${last - first + 1} removed: ${visibleLast - visibleFirst + 1} ${first}:${last} ${offset}`);
      //removeRows(visibleFirst, visibleLast);
      this.removeAll();
      this.addAtBottom(first, last);
    } else if (first < this.visibleFirst) {
      //some first rows missing and some last rows to much
      //console.log(`up added: ${visibleFirst - first + 1} removed: ${visibleLast - last + 1} ${first}:${last} ${offset}`);
      this.removeFromBottom(last + 1, this.visibleLast);
      this.addAtBeginning(first, this.visibleFirst - 1);
    } else {
      //console.log(`do added: ${last - visibleLast + 1} removed: ${first - visibleFirst + 1} ${first}:${last} ${offset}`);
      //some last rows missing and some first rows to much
      this.removeFromBeginning(this.visibleFirst, first - 1);
      this.addAtBottom(this.visibleLast + 1, last);
    }

    this.visibleFirst = first;
    this.visibleLast = last;

    this.updateOffset(firstRowPos, context.totalHeight);
    return 'partial';
  }
}

export default ABaseRenderer;
