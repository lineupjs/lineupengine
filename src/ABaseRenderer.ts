/**
 * Created by Samuel Gratzl on 13.07.2017.
 */
import {IExceptionContext, range} from './logic';
import {IAbortAblePromise, isAbortAble, ABORTED} from './abortAble';
export {default as abortAble} from './abortAble';
export {IExceptionContext} from './logic';


export abstract class ABaseRenderer {
  private readonly pool: HTMLElement[] = [];
  private readonly loadingPool: HTMLElement[] = [];
  private readonly loading = new Map<HTMLElement, IAbortAblePromise<void>>();

  protected visible = {
    first: 0,
    forcedFirst: 0,
    last: 0,
    forcedLast: 0
  };
  protected visibleFirstRowPos = 0;

  constructor(protected readonly body: HTMLElement) {
  }

  /**
   * the current render context, upon change `recreate` the whole table
   * @returns {IRenderContext}
   */
  protected abstract get context(): IExceptionContext;

  /**
   * creates a new row
   * @param {HTMLElement} node the node of the row
   * @param {number} index the row index
   * @returns {IAbortAblePromise<void> | void} either an abortable or nothing
   */
  protected abstract createRow(node: HTMLElement, index: number): IAbortAblePromise<void>|void;

  /**
   * updates a row
   * @param {HTMLElement} node the node of the row
   * @param {number} index the row index
   * @returns {IAbortAblePromise<void> | void} either an abortable or nothing
   */
  protected abstract updateRow(node: HTMLElement, index: number): IAbortAblePromise<void>|void;


  private static cleanUp(item: HTMLElement) {
    if (item.style.height) {
      item.style.height = null;
    }
  }

  private select(index: number): {item: HTMLElement, result: IAbortAblePromise<void>|void} {
    let item: HTMLElement;
    let result: IAbortAblePromise<void>|void;
    if (this.pool.length > 0) {
      item = this.pool.pop()!;
      result = this.updateRow(item, index);
    } else if (this.loadingPool.length > 0) {
      item = this.loadingPool.pop()!;
      item.classList.remove('loading');
      result = this.createRow(item, index);
    } else {
      item = this.body.ownerDocument.createElement('div');
      result = this.createRow(item, index);
    }
    item.dataset.index = String(index);
    return {item, result};
  }

  private selectProxy() {
    let proxy: HTMLElement;
    if (this.loadingPool.length > 0) {
      proxy = this.loadingPool.pop()!;
    } else {
      proxy = this.body.ownerDocument.createElement('div');
      proxy.classList.add('loading');
    }
    return proxy;
  }

  private recycle(item: HTMLElement) {
    ABaseRenderer.cleanUp(item);
    // check if the original dom element is still being manipulated
    if (this.loading.has(item)) {
      const abort = this.loading.get(item)!;
      abort.abort();
    } else {
      this.pool.push(item);
    }
  }

  private proxy(item: HTMLElement, result: IAbortAblePromise<void>|void) {
    if (!isAbortAble(result)) {
      return item;
    }
    const abort = <IAbortAblePromise<void>>result;
    //lazy loading

    const real = item;
    const proxy = this.selectProxy();
    // copy attributes
    proxy.dataset.index = real.dataset.index;
    proxy.style.height = real.style.height;

    this.loading.set(proxy, abort);
    abort.then((result) => {
      if (result === ABORTED) {
        //aborted can recycle the real one
        ABaseRenderer.cleanUp(real);
        this.pool.push(real);
      } else {
        //fully loaded
        this.body.replaceChild(real, proxy);
      }
      this.loading.delete(proxy);
      ABaseRenderer.cleanUp(proxy);
      this.loadingPool.push(proxy);
    });
    return proxy;
  }

  private create(index: number) {
    const {item, result} = this.select(index);

    const ex = this.context.exceptionsLookup;
    if (ex.has(index)) {
      item.style.height = ex.get(index) + 'px';
    }

    return this.proxy(item, result);
  }

  protected removeAll() {
    const arr = <HTMLElement[]>Array.from(this.body.children);
    this.body.innerHTML = '';
    arr.forEach((item) => {
      this.recycle(item);
    });
  }


  protected update() {
    for(let i = this.visible.first; i <= this.visible.last; ++i) {
      const item = <HTMLElement>this.body.children[i];
      if (this.loading.has(item)) {
       // still loading
        continue;
      }
      const abort = this.updateRow(item, i);

      const proxied = this.proxy(item, abort);
      if (proxied !== item) { //got a proxy back
        this.body.replaceChild(proxied, item);
      }
    }
  }

  protected removeFromBeginning(from: number, to: number) {
    return this.remove(from, to, true);
  }

  protected removeFromBottom(from: number, to: number) {
    return this.remove(from, to, false);
  }

  private remove(from: number, to: number, fromBeginning: boolean) {
    for (let i = from; i <= to; ++i) {
      const item = <HTMLElement>(fromBeginning ? this.body.firstChild : this.body.lastChild);
      this.body.removeChild(item);
      this.recycle(item);
    }
  }

  protected addAtBeginning(from: number, to: number) {
    for (let i = to; i >= from; --i) {
      this.body.insertAdjacentElement('afterbegin', this.create(i));
    }
  }

  protected addAtBottom(from: number, to: number) {
    for (let i = from; i <= to; ++i) {
      this.body.appendChild(this.create(i));
    }
  }

  protected updateOffset(firstRowPos: number, totalHeight: number) {
    this.visibleFirstRowPos = firstRowPos;
    if (this.visible.first % 2 === 1) {
      //odd start patch for correct background
      this.body.classList.add('odd');
    } else {
      this.body.classList.remove('odd');
    }

    this.body.style.transform = `translate(0, ${firstRowPos.toFixed(0)}px)`;
    this.body.style.height = `${(totalHeight - firstRowPos).toFixed(0)}px`;
  }

  /**
   * initializes the table and register the onscroll listener
   */
  protected init() {
    const scroller = <HTMLElement>this.body.parentElement;

    //sync scrolling of header and body
    let oldTop = scroller.scrollTop;
    scroller.addEventListener('scroll', () => {
      const top = scroller.scrollTop;
      if (oldTop !== top) {
        const isGoingDown = top > oldTop;
        oldTop = top;
        this.onScrolledVertically(top, scroller.clientHeight, isGoingDown);
      }
    });
    this.recreate();
  }

  /**
   * removes all rows and recreates the table
   */
  protected recreate() {
    const context = this.context;

    this.removeAll();

    const scroller = <HTMLElement>this.body.parentElement;
    const {first, last, firstRowPos} = range(scroller.scrollTop, scroller.clientHeight, context.defaultRowHeight, context.exceptions, context.numberOfRows);

    this.visible.first = this.visible.forcedFirst = first;
    this.visible.last = this.visible.forcedLast = last;

    this.addAtBottom(first, last);
    this.updateOffset(firstRowPos, context.totalHeight);
  }
  /**
   * scrolling vertically
   * @param {number} scrollTop
   * @param {number} clientHeight
   * @param {boolean} _isGoingDown hint whether the scrollTop increases
   * @returns {"full" | "partial"} full in case of a full rebuild or partial update
   */
  protected onScrolledVertically(scrollTop: number, clientHeight: number, _isGoingDown: boolean): 'full' | 'partial' {
    const context = this.context;
    const {first, last, firstRowPos} = range(scrollTop, clientHeight, context.defaultRowHeight, context.exceptions, context.numberOfRows);

    this.visible.forcedFirst = first;
    this.visible.forcedLast = last;

    if ((first - this.visible.first) >= 0 && (last - this.visible.last) <= 0) {
      //nothing to do
      return 'full';
    }

    if (first > this.visible.last || last < this.visible.first) {
      //no overlap, clean and draw everything
      //console.log(`ff added: ${last - first + 1} removed: ${visibleLast - visibleFirst + 1} ${first}:${last} ${offset}`);
      //removeRows(visibleFirst, visibleLast);
      this.removeAll();
      this.addAtBottom(first, last);
    } else if (first < this.visible.first) {
      //some first rows missing and some last rows to much
      //console.log(`up added: ${visibleFirst - first + 1} removed: ${visibleLast - last + 1} ${first}:${last} ${offset}`);
      this.removeFromBottom(last + 1, this.visible.last);
      this.addAtBeginning(first, this.visible.first - 1);
    } else {
      //console.log(`do added: ${last - visibleLast + 1} removed: ${first - visibleFirst + 1} ${first}:${last} ${offset}`);
      //some last rows missing and some first rows to much
      this.removeFromBeginning(this.visible.first, first - 1);
      this.addAtBottom(this.visible.last + 1, last);
    }

    this.visible.first = first;
    this.visible.last = last;

    this.updateOffset(firstRowPos, context.totalHeight);
    return 'partial';
  }
}

export default ABaseRenderer;
