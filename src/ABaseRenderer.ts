/**
 * Created by Samuel Gratzl on 13.07.2017.
 */
import {IRowHeightException, IRowHeightExceptionLookup, range} from './logic';
import {IAbortAblePromise, isAbortAble, ABORTED} from './abortAble';
export {default as abortAble} from './abortAble';


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
  private readonly loadingPool: HTMLElement[] = [];
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


  private cleanUp(item: HTMLElement) {
    if (item.style.height) {
      item.style.height = null;
    }
  }

  uid: number = 0;
  puid: number = 0;

  private select(index: number): {item: HTMLElement, result: IAbortAblePromise<void>|void} {
    let item: HTMLElement;
    let result: IAbortAblePromise<void>|void;
    if (this.pool.length > 0) {
      item = this.pool.pop();
      result = this.updateRow(item, index);
    } else if (this.loadingPool.length > 0) {
      item = this.loadingPool.pop();
      item.classList.remove('loading');
      result = this.createRow(item, index);
    } else {
      item = this.node.ownerDocument.createElement('div');
      item.dataset.uid = String(this.uid++);
      result = this.createRow(item, index);
    }
    item.dataset.index = String(index);
    return {item, result};
  }

  private selectProxy() {
    let proxy: HTMLElement;
    if (this.loadingPool.length > 0) {
      proxy = this.loadingPool.pop();
    } else {
      proxy = this.node.ownerDocument.createElement('div');
      proxy.dataset.uid = 'p' + String(this.puid++);
      proxy.classList.add('loading');
    }
    return proxy;
  }

  private recycle(item: HTMLElement) {
    this.cleanUp(item);
    // check if the original dom element is still being manipulated
    if (this.loading.has(item)) {
      const abort = this.loading.get(item);
      console.log('abort', item.dataset.uid);
      abort.abort();
    } else {
      console.log('recycle', item.dataset.uid);
      this.pool.push(item);
    }
  }

  private create(index: number) {
    const {item, result} = this.select(index);

    if (!isAbortAble(result)) {
      return item;
    }
    const abort = <IAbortAblePromise<void>>result;
    //lazy loading

    const real = item;
    const proxy = this.selectProxy();
    // copy attributes
    proxy.dataset.index = String(index);
    proxy.style.height = real.style.height;

    this.loading.set(proxy, abort);
    abort.then((result) => {
      if (result === ABORTED) {
        //aborted can recycle the real one
        console.log('been', real.dataset.uid, 'with', index);
        this.cleanUp(real);
        this.pool.push(real);
      } else {
        //fully loaded
        console.log('fully', proxy.dataset.uid, real.dataset.uid, 'with', index);
        this.node.replaceChild(real, proxy);
      }
      this.loading.delete(proxy);
      this.cleanUp(proxy);
      this.loadingPool.push(proxy);
    });
    return proxy;
  }

  protected removeAll() {
    const arr = <HTMLElement[]>Array.from(this.node.children);
    this.node.innerHTML = '';
    arr.forEach((item) => {
      this.recycle(item);
    });
  }

  protected removeFromBeginning(from: number, to: number) {
    return this.remove(from, to, true);
  }

  protected removeFromBottom(from: number, to: number) {
    return this.remove(from, to, false);
  }

  private remove(from: number, to: number, fromBeginning: boolean) {
    for (let i = from; i <= to; ++i) {
      const item = <HTMLElement>(fromBeginning ? this.node.firstChild : this.node.lastChild);
      this.node.removeChild(item);
      this.recycle(item);
    }
  }

  protected addAtBeginning(from: number, to: number) {
    return this.add(from, to, true);
  }

  protected addAtBottom(from: number, to: number) {
    return this.add(from, to, false);
  }

  private add(from: number, to: number, atBeginning: boolean) {
    if (atBeginning) {
      for (let i = to; i >= from; --i) {
        this.node.insertAdjacentElement('afterbegin', this.create(i));
      }
    } else {
      for (let i = from; i <= to; ++i) {
        this.node.appendChild(this.create(i));
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
